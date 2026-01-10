#!/bin/bash

echo "========================================"
echo "Safari Ops Mobile - Cache Cleaner"
echo "========================================"
echo ""

echo "[1/6] Clearing Metro bundler cache..."
npx react-native start --reset-cache > /dev/null 2>&1 &
METRO_PID=$!
sleep 2
kill $METRO_PID > /dev/null 2>&1
echo "    ✓ Metro cache cleared"

echo "[2/6] Clearing node_modules cache..."
if [ -d "node_modules/.cache" ]; then
    rm -rf node_modules/.cache
    echo "    ✓ Cleared node_modules/.cache"
else
    echo "    - node_modules/.cache not found"
fi

echo "[3/6] Clearing .expo cache..."
if [ -d ".expo" ]; then
    rm -rf .expo
    echo "    ✓ Cleared .expo"
else
    echo "    - .expo not found"
fi

echo "[4/6] Clearing Metro temp files..."
rm -rf $TMPDIR/metro-* > /dev/null 2>&1
rm -rf $TMPDIR/haste-map-* > /dev/null 2>&1
rm -rf /tmp/metro-* > /dev/null 2>&1
rm -rf /tmp/haste-map-* > /dev/null 2>&1
echo "    ✓ Cleared Metro temp files"

echo "[5/6] Verifying npm cache..."
npm cache verify > /dev/null 2>&1
echo "    ✓ NPM cache verified"

echo "[6/6] Clearing Watchman (if installed)..."
if command -v watchman &> /dev/null; then
    watchman watch-del-all > /dev/null 2>&1
    echo "    ✓ Watchman cache cleared"
else
    echo "    - Watchman not installed (optional)"
fi

echo ""
echo "========================================"
echo "✅ Cache cleared successfully!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Run: npm start"
echo "2. Or:  npx expo start"
echo "3. Reload your app (Cmd+R or shake device)"
echo ""
