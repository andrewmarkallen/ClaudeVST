#include "PluginEditor.h"

ClaudeVSTAudioProcessorEditor::ClaudeVSTAudioProcessorEditor(ClaudeVSTAudioProcessor& p)
    : AudioProcessorEditor(&p), processorRef(p), sendButton("Send"), voiceButton("Mic")
{
    setSize(500, 750);

    // Chat history - read only, scrollable
    chatHistory.setMultiLine(true);
    chatHistory.setReadOnly(true);
    chatHistory.setScrollbarsShown(true);
    chatHistory.setColour(juce::TextEditor::backgroundColourId, inputBgColor);
    chatHistory.setColour(juce::TextEditor::textColourId, textColor);
    chatHistory.setColour(juce::TextEditor::outlineColourId, bgColor);
    chatHistory.setFont(juce::FontOptions(14.0f));
    addAndMakeVisible(chatHistory);

    // Input field
    inputField.setMultiLine(false);
    inputField.setReturnKeyStartsNewLine(false);
    inputField.setColour(juce::TextEditor::backgroundColourId, inputBgColor);
    inputField.setColour(juce::TextEditor::textColourId, textColor);
    inputField.setColour(juce::TextEditor::outlineColourId, accentColor);
    inputField.setFont(juce::FontOptions(14.0f));
    inputField.setTextToShowWhenEmpty("Ask Claude about your mix...", juce::Colours::grey);
    inputField.onReturnKey = [this] { sendMessage(); };
    addAndMakeVisible(inputField);

    // Send button
    sendButton.setColour(juce::TextButton::buttonColourId, accentColor);
    sendButton.setColour(juce::TextButton::textColourOffId, juce::Colours::white);
    sendButton.onClick = [this] { sendMessage(); };
    addAndMakeVisible(sendButton);

    // Voice button - uses whisper.cpp (no TCC needed!)
    voiceButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff4a4a4a));
    voiceButton.setColour(juce::TextButton::textColourOffId, textColor);
    voiceButton.setTooltip("Hold to speak (uses Whisper AI)");
    voiceButton.onStateChange = [this] {
        auto& recognizer = processorRef.getSpeechRecognizer();

        if (voiceButton.isDown())
        {
            if (recognizer.hasPermission())
            {
                voiceButton.setButtonText("...");
                voiceButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xffcc4444));
                recognizer.startListening([this](const juce::String& text) {
                    if (text.isNotEmpty())
                    {
                        inputField.setText(text);
                        sendMessage();
                    }
                    voiceButton.setButtonText("Mic");
                    voiceButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff4a4a4a));
                });
            }
            else
            {
                appendToChat("System", "Whisper model not loaded. Check console for errors.");
            }
        }
        else if (recognizer.isListening())
        {
            recognizer.stopListening();
            voiceButton.setButtonText("...");  // Keep showing ... while transcribing
        }
    };
    addAndMakeVisible(voiceButton);

    // Level display
    levelLabel.setColour(juce::Label::textColourId, textColor);
    levelLabel.setFont(juce::FontOptions(12.0f));
    levelLabel.setText("Levels: -- dB", juce::dontSendNotification);
    addAndMakeVisible(levelLabel);

    // Reference track section
    loadReferenceButton.setColour(juce::TextButton::buttonColourId, accentColor);
    loadReferenceButton.onClick = [this] { loadReferenceTrack(); };
    addAndMakeVisible(loadReferenceButton);

    clearButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff4a4a4a));
    clearButton.onClick = [this] { clearReferenceTrack(); };
    addAndMakeVisible(clearButton);

    applyButton.setColour(juce::TextButton::buttonColourId, juce::Colour(0xff4a9a4a));
    applyButton.onClick = [this] { applyToAbleton(); };
    applyButton.setEnabled(false);
    addAndMakeVisible(applyButton);

    detailSlider.setRange(0, 2, 1);  // 3 levels
    detailSlider.setValue(1);
    detailSlider.setSliderStyle(juce::Slider::LinearHorizontal);
    detailSlider.setTextBoxStyle(juce::Slider::NoTextBox, true, 0, 0);
    detailSlider.onValueChange = [this] { updateDetailLevel(); };
    addAndMakeVisible(detailSlider);

    detailLabel.setText("Detail: Medium", juce::dontSendNotification);
    detailLabel.setColour(juce::Label::textColourId, textColor);
    addAndMakeVisible(detailLabel);

    addAndMakeVisible(radialView);

    // Welcome message
    appendToChat("ClaudeVST", "Welcome! Messages go to ClaudeVST/messages/\n\n"
                              "Type or hold [Mic] to speak.\n"
                              "Audio analysis is written to audio_analysis.json\n\n"
                              "Try asking: \"How does my mix sound?\"");

    // Connect to AbletonOSC
    if (oscClient.connect())
    {
        appendToChat("System", "Connected to AbletonOSC");
    }

    // Set up action callback for OSC commands
    claudeClient.setActionCallback([this](const juce::var& action) {
        if (oscClient.executeAction(action))
        {
            auto* obj = action.getDynamicObject();
            if (obj)
            {
                juce::String actionType = obj->getProperty("action").toString();
                DBG("Executed OSC action: " << actionType);
            }
        }
    });

    // Start timer for UI updates
    startTimerHz(30);
}

ClaudeVSTAudioProcessorEditor::~ClaudeVSTAudioProcessorEditor()
{
    stopTimer();
}

void ClaudeVSTAudioProcessorEditor::paint(juce::Graphics& g)
{
    g.fillAll(bgColor);

    // Header
    g.setColour(accentColor);
    g.setFont(juce::Font(juce::FontOptions(18.0f)).boldened());
    g.drawText("ClaudeVST", 10, 10, getWidth() - 20, 30, juce::Justification::centred);
}

void ClaudeVSTAudioProcessorEditor::resized()
{
    auto bounds = getLocalBounds().reduced(10);

    // Header space
    bounds.removeFromTop(40);

    // Level display at top
    levelLabel.setBounds(bounds.removeFromTop(20));
    bounds.removeFromTop(5);

    // Reference track section
    auto refSection = bounds.removeFromTop(280);

    auto buttonRow = refSection.removeFromTop(30);
    loadReferenceButton.setBounds(buttonRow.removeFromLeft(120));
    buttonRow.removeFromLeft(10);
    clearButton.setBounds(buttonRow.removeFromLeft(60));

    refSection.removeFromTop(10);
    radialView.setBounds(refSection.removeFromTop(180));

    refSection.removeFromTop(5);
    auto detailRow = refSection.removeFromTop(25);
    detailLabel.setBounds(detailRow.removeFromLeft(100));
    detailSlider.setBounds(detailRow);

    refSection.removeFromTop(5);
    applyButton.setBounds(refSection.removeFromTop(30).reduced(50, 0));

    bounds.removeFromTop(10);

    // Input area at bottom
    auto inputArea = bounds.removeFromBottom(35);
    sendButton.setBounds(inputArea.removeFromRight(60));
    inputArea.removeFromRight(5);
    voiceButton.setBounds(inputArea.removeFromRight(45));
    inputArea.removeFromRight(5);
    inputField.setBounds(inputArea);

    bounds.removeFromBottom(10);

    // Chat history fills the rest
    chatHistory.setBounds(bounds);
}

void ClaudeVSTAudioProcessorEditor::timerCallback()
{
    // Update level display
    auto& analyzer = processorRef.getAudioAnalyzer();
    float rmsL = analyzer.getRMSLevel(0);
    float rmsR = analyzer.getRMSLevel(1);
    float peakL = analyzer.getPeakLevel(0);
    float peakR = analyzer.getPeakLevel(1);

    juce::String levelText;
    levelText << "RMS: L " << juce::String(rmsL, 1) << " dB  R " << juce::String(rmsR, 1) << " dB"
              << "  |  Peak: L " << juce::String(peakL, 1) << " dB  R " << juce::String(peakR, 1) << " dB";
    levelLabel.setText(levelText, juce::dontSendNotification);

    // Write audio analysis to file every ~500ms (15 frames at 30fps)
    timerCounter++;
    if (timerCounter >= 15)
    {
        timerCounter = 0;
        claudeClient.updateAudioAnalysis(buildAnalysisJson());
    }
}

void ClaudeVSTAudioProcessorEditor::sendMessage()
{
    auto userMessage = inputField.getText().trim();
    if (userMessage.isEmpty())
        return;

    appendToChat("You", userMessage);
    inputField.clear();

    // Build context from audio analysis and Ableton
    auto context = buildContextString();

    // Send to Claude
    claudeClient.sendMessage(userMessage, context, [this](const juce::String& response) {
        juce::MessageManager::callAsync([this, response] {
            onClaudeResponse(response);
        });
    });
}

void ClaudeVSTAudioProcessorEditor::appendToChat(const juce::String& sender, const juce::String& message)
{
    auto currentText = chatHistory.getText();
    if (currentText.isNotEmpty())
        currentText += "\n\n";

    currentText += "[" + sender + "]\n" + message;
    chatHistory.setText(currentText);
    chatHistory.setCaretPosition(chatHistory.getText().length());
}

void ClaudeVSTAudioProcessorEditor::onClaudeResponse(const juce::String& response)
{
    appendToChat("Claude", response);

    // Speak the response through TTS
    processorRef.getSpeechSynthesizer().speak(response);
}

juce::String ClaudeVSTAudioProcessorEditor::buildContextString()
{
    juce::String context;

    // Audio analysis context
    auto& analyzer = processorRef.getAudioAnalyzer();
    context += "=== AUDIO ANALYSIS ===\n";
    context += "RMS Level: L=" + juce::String(analyzer.getRMSLevel(0), 1) + "dB, R=" + juce::String(analyzer.getRMSLevel(1), 1) + "dB\n";
    context += "Peak Level: L=" + juce::String(analyzer.getPeakLevel(0), 1) + "dB, R=" + juce::String(analyzer.getPeakLevel(1), 1) + "dB\n";
    context += "Crest Factor: " + juce::String(analyzer.getCrestFactor(), 1) + "dB\n";
    context += "Spectrum: " + analyzer.getSpectrumSummary() + "\n";

    // Ableton context (if connected)
    if (oscClient.isConnected())
    {
        context += "\n=== ABLETON SESSION ===\n";
        context += oscClient.getSessionInfo();
    }

    return context;
}

juce::String ClaudeVSTAudioProcessorEditor::buildAnalysisJson()
{
    auto& analyzer = processorRef.getAudioAnalyzer();

    auto obj = new juce::DynamicObject();
    obj->setProperty("timestamp", juce::Time::currentTimeMillis());

    // Levels
    auto levels = new juce::DynamicObject();
    levels->setProperty("rms_left_db", analyzer.getRMSLevel(0));
    levels->setProperty("rms_right_db", analyzer.getRMSLevel(1));
    levels->setProperty("peak_left_db", analyzer.getPeakLevel(0));
    levels->setProperty("peak_right_db", analyzer.getPeakLevel(1));
    levels->setProperty("crest_factor_db", analyzer.getCrestFactor());
    obj->setProperty("levels", juce::var(levels));

    // Spectrum bands
    auto& bands = analyzer.getSpectrumBands();
    auto spectrum = new juce::DynamicObject();
    spectrum->setProperty("sub_db", bands[0]);
    spectrum->setProperty("bass_db", bands[1]);
    spectrum->setProperty("low_mid_db", bands[2]);
    spectrum->setProperty("mid_db", bands[3]);
    spectrum->setProperty("upper_mid_db", bands[4]);
    spectrum->setProperty("presence_db", bands[5]);
    spectrum->setProperty("brilliance_db", bands[6]);
    spectrum->setProperty("air_db", bands[7]);
    obj->setProperty("spectrum", juce::var(spectrum));

    // Ableton info if available
    if (oscClient.isConnected())
    {
        auto ableton = new juce::DynamicObject();
        ableton->setProperty("tempo", oscClient.getTempo());
        ableton->setProperty("num_tracks", oscClient.getNumTracks());
        obj->setProperty("ableton", juce::var(ableton));
    }

    return juce::JSON::toString(juce::var(obj));
}

void ClaudeVSTAudioProcessorEditor::loadReferenceTrack()
{
    if (isAnalyzing)
        return;

    fileChooser = std::make_unique<juce::FileChooser>(
        "Select Reference Track",
        juce::File::getSpecialLocation(juce::File::userMusicDirectory),
        "*.wav;*.mp3;*.flac;*.aiff");

    fileChooser->launchAsync(
        juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectFiles,
        [this](const juce::FileChooser& fc)
    {
        auto file = fc.getResult();
        if (file.existsAsFile())
        {
            isAnalyzing = true;
            loadReferenceButton.setButtonText("Analyzing...");
            loadReferenceButton.setEnabled(false);

            DockerRunner::runMsafAnalysis(file.getFullPathName(),
                [this, filePath = file.getFullPathName()](bool success, const juce::String& output)
            {
                isAnalyzing = false;
                loadReferenceButton.setButtonText("Load Reference");
                loadReferenceButton.setEnabled(true);

                if (success)
                {
                    referenceData = ReferenceTrackData::fromJson(output, filePath);
                    if (referenceData.isLoaded())
                    {
                        radialView.setData(&referenceData);
                        applyButton.setEnabled(true);
                        detailSlider.setValue(1);
                        appendToChat("System", "Reference track loaded: " +
                                     juce::String(referenceData.getCurrentSegments().size()) + " segments detected");
                    }
                    else
                    {
                        appendToChat("System", "Failed to parse analysis results");
                    }
                }
                else
                {
                    appendToChat("System", "Analysis failed: " + output);
                }
            });
        }
    });
}

void ClaudeVSTAudioProcessorEditor::clearReferenceTrack()
{
    referenceData = ReferenceTrackData();
    radialView.setData(nullptr);
    applyButton.setEnabled(false);
}

void ClaudeVSTAudioProcessorEditor::updateDetailLevel()
{
    int level = static_cast<int>(detailSlider.getValue());
    referenceData.currentLevel = level;

    juce::String levelName;
    switch (level)
    {
        case 0: levelName = "Coarse"; break;
        case 1: levelName = "Medium"; break;
        case 2: levelName = "Fine"; break;
        default: levelName = "Medium";
    }
    detailLabel.setText("Detail: " + levelName, juce::dontSendNotification);

    radialView.setData(&referenceData);
}

void ClaudeVSTAudioProcessorEditor::applyToAbleton()
{
    if (!referenceData.isLoaded())
        return;

    juce::PopupMenu menu;
    menu.addItem(1, "Session View (clips)");
    menu.addItem(2, "Arrangement View (timeline)");
    menu.addItem(3, "Both");

    menu.showMenuAsync(juce::PopupMenu::Options().withTargetComponent(&applyButton),
        [this](int result)
    {
        switch (result)
        {
            case 1: applyToSession(); break;
            case 2: applyToArrangement(); break;
            case 3:
                applyToSession();
                // Note: applyToArrangement will be called separately
                // to create a second track for arrangement view
                break;
            default: break;
        }
    });
}

void ClaudeVSTAudioProcessorEditor::applyToSession()
{
    applyButton.setEnabled(false);
    applyButton.setButtonText("Creating...");
    appendToChat("System", "Creating session view clips...");

    // Create audio track
    UnifiedBridgeClient::createAudioTrack(-1, [this](bool success, const juce::var& response)
    {
        if (!success)
        {
            appendToChat("System", "Failed to create audio track");
            applyButton.setEnabled(true);
            applyButton.setButtonText("Apply to Ableton");
            return;
        }

        int trackIndex = response.getProperty("track_index", -1);
        if (trackIndex < 0)
        {
            appendToChat("System", "Invalid track index returned");
            applyButton.setEnabled(true);
            applyButton.setButtonText("Apply to Ableton");
            return;
        }

        // Set track name
        juce::File audioFile(referenceData.filePath);
        juce::String trackName = "Ref: " + audioFile.getFileNameWithoutExtension();

        UnifiedBridgeClient::setTrackName(trackIndex, trackName, [](bool, const juce::var&) {});

        // Create clips for each segment
        const auto& segments = referenceData.getCurrentSegments();
        createClipsRecursive(trackIndex, 0, segments);
    });
}

void ClaudeVSTAudioProcessorEditor::applyToArrangement()
{
    applyButton.setEnabled(false);
    applyButton.setButtonText("Creating...");
    appendToChat("System", "Creating arrangement clips...");

    UnifiedBridgeClient::createAudioTrack(-1, [this](bool success, const juce::var& response)
    {
        if (!success)
        {
            appendToChat("System", "Failed to create audio track for arrangement");
            applyButton.setEnabled(true);
            applyButton.setButtonText("Apply to Ableton");
            return;
        }

        int trackIndex = response.getProperty("track_index", -1);
        if (trackIndex < 0)
        {
            appendToChat("System", "Invalid track index");
            applyButton.setEnabled(true);
            applyButton.setButtonText("Apply to Ableton");
            return;
        }

        // Set track name
        juce::File audioFile(referenceData.filePath);
        juce::String trackName = "Ref: " + audioFile.getFileNameWithoutExtension() + " (Arr)";

        UnifiedBridgeClient::setTrackName(trackIndex, trackName, [](bool, const juce::var&) {});

        // Convert seconds to beats for arrangement placement
        float beatsPerSecond = referenceData.tempoBpm / 60.0f;
        const auto& segments = referenceData.getCurrentSegments();
        int clipCount = 0;

        for (const auto& seg : segments)
        {
            float positionBeats = seg.startSeconds * beatsPerSecond;

            UnifiedBridgeClient::createAudioClipArrangement(trackIndex, referenceData.filePath, positionBeats,
                [](bool, const juce::var&) {});

            clipCount++;
        }

        appendToChat("System", "Arrangement clips created! " + juce::String(clipCount) + " clips on timeline.");
        applyButton.setEnabled(true);
        applyButton.setButtonText("Apply to Ableton");
    });
}

void ClaudeVSTAudioProcessorEditor::createClipsRecursive(int trackIndex, int clipIndex,
                                                          const std::vector<Segment>& segments)
{
    if (clipIndex >= static_cast<int>(segments.size()))
    {
        appendToChat("System", "Reference track applied! " +
                     juce::String(segments.size()) + " clips created.");
        applyButton.setEnabled(true);
        applyButton.setButtonText("Apply to Ableton");
        return;
    }

    const auto& seg = segments[static_cast<size_t>(clipIndex)];

    UnifiedBridgeClient::createAudioClipSession(trackIndex, clipIndex, referenceData.filePath,
        [this, trackIndex, clipIndex, segments, seg](bool success, const juce::var& response)
    {
        if (!success)
        {
            appendToChat("System", "Failed to create clip " + juce::String(clipIndex));
            // Continue anyway
        }

        // Set clip name
        UnifiedBridgeClient::setClipName(trackIndex, clipIndex, seg.label,
            [](bool, const juce::var&) {});

        // Map rainbow color to Ableton color index (0-69)
        int colorIndex = static_cast<int>((static_cast<float>(clipIndex) / static_cast<float>(segments.size())) * 69.0f);
        UnifiedBridgeClient::setClipColor(trackIndex, clipIndex, colorIndex,
            [](bool, const juce::var&) {});

        // Continue with next clip
        createClipsRecursive(trackIndex, clipIndex + 1, segments);
    });
}
