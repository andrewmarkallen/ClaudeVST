#!/bin/bash
# Build and deploy ClaudeVST with A/B deployment strategy
# Creates timestamped build alongside existing version for hot-swapping

set -e

PROJECT_ROOT="/Users/mk/c/ClaudeVST"
VST3_DIR="$HOME/Library/Audio/Plug-Ins/VST3"
AU_DIR="$HOME/Library/Audio/Plug-Ins/Components"

echo "=========================================="
echo "ClaudeVST A/B Build & Deploy"
echo "=========================================="
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Get current timestamp for unique build
BUILD_TIMESTAMP=$(date +"%m%d_%H%M")
echo "Build timestamp: $BUILD_TIMESTAMP"
echo "Plugin name: ClaudeVST_${BUILD_TIMESTAMP}"
echo ""

# Configure with CMake (this updates PLUGIN_NAME in CMakeLists.txt)
echo "Configuring..."
cmake -B build -G Ninja -DCMAKE_BUILD_TYPE=Release

# Build
echo ""
echo "Building..."
cmake --build build

# Run post-build script (permissions and signing)
echo ""
echo "Adding permissions and signing..."
./scripts/post_build.sh

# List current plugins
echo ""
echo "Current VST3 plugins:"
ls -t "$VST3_DIR"/ClaudeVST*.vst3 2>/dev/null || echo "  None"

echo ""
echo "Current AU plugins:"
ls -t "$AU_DIR"/ClaudeVST*.component 2>/dev/null || echo "  None"

# Count existing plugins
VST3_COUNT=$(ls "$VST3_DIR"/ClaudeVST*.vst3 2>/dev/null | wc -l | tr -d ' ')
AU_COUNT=$(ls "$AU_DIR"/ClaudeVST*.component 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "=========================================="
echo "Build Complete!"
echo "=========================================="
echo ""
echo "New plugin deployed:"
echo "  VST3: ClaudeVST_${BUILD_TIMESTAMP}.vst3"
echo "  AU:   ClaudeVST_${BUILD_TIMESTAMP}.component"
echo ""

if [ "$VST3_COUNT" -gt 1 ]; then
    echo "📝 A/B Deployment Status:"
    echo "  You now have $VST3_COUNT versions in your VST3 folder."
    echo ""
    echo "  Active version: The one currently loaded in Ableton"
    echo "  New version:    ClaudeVST_${BUILD_TIMESTAMP}.vst3"
    echo ""
    echo "To switch to new version:"
    echo "  1. In Ableton, remove the old ClaudeVST plugin"
    echo "  2. Add the new ClaudeVST_${BUILD_TIMESTAMP} plugin"
    echo "  3. (Optional) Delete the old plugin file to clean up"
    echo ""
    echo "While 2 versions exist, you can keep developing the inactive one."
else
    echo "📝 First Build:"
    echo "  This is the first/only version."
    echo "  Rescan plugins in Ableton and add ClaudeVST_${BUILD_TIMESTAMP}."
fi

echo ""
echo "=========================================="
