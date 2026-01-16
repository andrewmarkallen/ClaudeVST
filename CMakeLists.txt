cmake_minimum_required(VERSION 3.22)

project(ClaudeVST VERSION 0.1.0)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Generate timestamp for unique plugin name (avoids Ableton caching)
string(TIMESTAMP BUILD_TIMESTAMP "%m%d_%H%M")
set(PLUGIN_NAME "ClaudeVST_${BUILD_TIMESTAMP}")

# Whisper.cpp - pre-built shared library (build once, link forever)
set(WHISPER_LIB_DIR "${CMAKE_SOURCE_DIR}/lib")
set(WHISPER_MODEL_PATH "${CMAKE_SOURCE_DIR}/whisper.cpp/models/ggml-tiny.bin")

# Add JUCE
add_subdirectory(JUCE)

# Plugin target
juce_add_plugin(ClaudeVST
    COMPANY_NAME "ClaudeVST"
    BUNDLE_ID "com.claudevst.plugin"
    IS_SYNTH FALSE
    NEEDS_MIDI_INPUT FALSE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD TRUE
    PLUGIN_MANUFACTURER_CODE Clvt
    PLUGIN_CODE Cvst
    FORMATS AU VST3
    PRODUCT_NAME "${PLUGIN_NAME}"
    MICROPHONE_PERMISSION_ENABLED TRUE
    MICROPHONE_PERMISSION_TEXT "ClaudeVST needs microphone access for voice input"
    PLIST_TO_MERGE "${CMAKE_SOURCE_DIR}/Info.plist"
)

# Source files
target_sources(ClaudeVST
    PRIVATE
        src/PluginProcessor.cpp
        src/PluginEditor.cpp
        src/ClaudeClient.cpp
        src/AudioAnalyzer.cpp
        src/OSCClient.cpp
        src/SpeechRecognizer.cpp
        src/SpeechSynthesizer.mm
        src/UnifiedControlAdapter.cpp
        src/ReferenceTrackData.cpp
        src/RadialSegmentView.cpp
        src/DockerRunner.cpp
        src/UnifiedBridgeClient.cpp
)

# JUCE modules
target_compile_definitions(ClaudeVST
    PUBLIC
        JUCE_WEB_BROWSER=0
        JUCE_USE_CURL=0
        JUCE_VST3_CAN_REPLACE_VST2=0
)

target_link_libraries(ClaudeVST
    PRIVATE
        juce::juce_audio_utils
        juce::juce_dsp
        juce::juce_osc
    PUBLIC
        juce::juce_recommended_config_flags
        juce::juce_recommended_lto_flags
        juce::juce_recommended_warning_flags
)

# Whisper.cpp for speech recognition (pre-built, no TCC issues)
target_include_directories(ClaudeVST PRIVATE ${WHISPER_LIB_DIR})
target_compile_definitions(ClaudeVST PRIVATE WHISPER_MODEL_PATH="${WHISPER_MODEL_PATH}")

# Link whisper and ggml libraries
target_link_libraries(ClaudeVST
    PRIVATE
        "${WHISPER_LIB_DIR}/libwhisper.dylib"
        "${WHISPER_LIB_DIR}/libggml.dylib"
        "${WHISPER_LIB_DIR}/libggml-base.dylib"
        "${WHISPER_LIB_DIR}/libggml-cpu.dylib"
)

# macOS frameworks
if(APPLE)
    target_link_libraries(ClaudeVST
        PRIVATE
            "-framework AVFoundation"
            "-framework Accelerate"
            "-framework Metal"
            "-framework MetalKit"
    )

    # Link Metal-accelerated ggml
    target_link_libraries(ClaudeVST
        PRIVATE
            "${WHISPER_LIB_DIR}/libggml-metal.dylib"
            "${WHISPER_LIB_DIR}/libggml-blas.dylib"
    )

    # Microphone permission
    target_compile_definitions(ClaudeVST
        PRIVATE
            JUCE_MICROPHONE_PERMISSION_ENABLED=1
    )
endif()
