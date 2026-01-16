#!/bin/bash
# Post-build script for ClaudeVST
# Adds required plist permissions and re-signs the plugins

set -e

# Find the most recently built plugins
VST3=$(ls -td ~/Library/Audio/Plug-Ins/VST3/ClaudeVST*.vst3 2>/dev/null | head -1)
AU=$(ls -td ~/Library/Audio/Plug-Ins/Components/ClaudeVST*.component 2>/dev/null | head -1)

add_permissions() {
    local plugin="$1"
    if [[ -d "$plugin" ]]; then
        echo "Adding permissions to: $plugin"

        # Add speech recognition permission
        /usr/libexec/PlistBuddy -c "Add :NSSpeechRecognitionUsageDescription string 'ClaudeVST needs speech recognition for voice input'" "$plugin/Contents/Info.plist" 2>/dev/null || \
        /usr/libexec/PlistBuddy -c "Set :NSSpeechRecognitionUsageDescription 'ClaudeVST needs speech recognition for voice input'" "$plugin/Contents/Info.plist"

        # Add microphone permission
        /usr/libexec/PlistBuddy -c "Add :NSMicrophoneUsageDescription string 'ClaudeVST needs microphone access for voice input'" "$plugin/Contents/Info.plist" 2>/dev/null || \
        /usr/libexec/PlistBuddy -c "Set :NSMicrophoneUsageDescription 'ClaudeVST needs microphone access for voice input'" "$plugin/Contents/Info.plist"

        # Re-sign
        codesign --force --sign - "$plugin"
        echo "Done: $plugin"
    fi
}

add_permissions "$VST3"
add_permissions "$AU"

echo ""
echo "Post-build complete!"
echo "VST3: $VST3"
echo "AU: $AU"
