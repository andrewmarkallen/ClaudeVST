#!/usr/bin/env swift
//
// TTSCompanion - Watches for Claude responses and speaks them
// Run with: swift TTSCompanion.swift
// Or compile: swiftc -o tts TTSCompanion.swift && ./tts
//

import Foundation
import AVFoundation

class TTSCompanion: NSObject, AVSpeechSynthesizerDelegate {
    let synthesizer = AVSpeechSynthesizer()
    let messagesPath: String
    var lastTimestamp: Int64 = 0
    var isSpeaking = false
    var speechQueue: [String] = []

    override init() {
        // Find messages directory relative to this script or use absolute path
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        messagesPath = "\(homeDir)/c/ClaudeVST/messages/from_claude.json"

        super.init()
        synthesizer.delegate = self
    }

    func start() {
        print("TTS Companion started")
        print("Watching: \(messagesPath)")
        print("Press Ctrl+C to stop\n")

        // Check for new messages every 500ms
        Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            self?.checkForNewMessages()
        }

        // Keep running
        RunLoop.main.run()
    }

    func checkForNewMessages() {
        guard let data = FileManager.default.contents(atPath: messagesPath),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let timestamp = json["timestamp"] as? Int64,
              let response = json["response"] as? String else {
            return
        }

        // New message?
        if timestamp > lastTimestamp {
            lastTimestamp = timestamp
            print("New response received!")
            queueSpeech(response)
        }
    }

    func queueSpeech(_ text: String) {
        speechQueue.append(text)
        if !isSpeaking {
            speakNext()
        }
    }

    func speakNext() {
        guard !speechQueue.isEmpty else {
            isSpeaking = false
            return
        }

        isSpeaking = true
        let text = speechQueue.removeFirst()

        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        utterance.pitchMultiplier = 1.0
        utterance.volume = 1.0

        // Try premium voices
        let preferredVoices = [
            "com.apple.voice.premium.en-US.Zoe",
            "com.apple.ttsbundle.siri_Nicky_en-US_compact",
            "com.apple.voice.premium.en-US.Samantha",
            "com.apple.voice.enhanced.en-US.Samantha"
        ]

        for voiceId in preferredVoices {
            if let voice = AVSpeechSynthesisVoice(identifier: voiceId) {
                utterance.voice = voice
                break
            }
        }

        // Fallback
        if utterance.voice == nil {
            utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        }

        print("Speaking: \(text.prefix(50))...")
        synthesizer.speak(utterance)
    }

    // AVSpeechSynthesizerDelegate
    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        print("Done speaking")
        speakNext()
    }
}

// Main
let companion = TTSCompanion()
companion.start()
