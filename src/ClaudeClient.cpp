#include "ClaudeClient.h"

ClaudeClient::ClaudeClient()
{
    // Ensure config directory exists
    getConfigDir().createDirectory();

    // Start polling for responses
    startTimerHz(2);  // Check twice per second
    connectionActive.store(true);
}

ClaudeClient::~ClaudeClient()
{
    stopTimer();
}

juce::File ClaudeClient::getConfigDir()
{
    // Messages folder inside the project directory
    return juce::File("/Users/mk/c/ClaudeVST/messages");
}

juce::File ClaudeClient::getOutboxFile()
{
    return getConfigDir().getChildFile("to_claude.json");
}

juce::File ClaudeClient::getMasterInboxFile()
{
    return getConfigDir().getChildFile("from_claude.json");
}

juce::File ClaudeClient::getTeacherInboxFile()
{
    return getConfigDir().getChildFile("from_teacher.json");
}

juce::File ClaudeClient::getAnalysisFile()
{
    return getConfigDir().getChildFile("audio_analysis.json");
}

void ClaudeClient::sendMessage(const juce::String& userMessage,
                                const juce::String& audioContext,
                                ResponseCallback callback)
{
    {
        juce::ScopedLock lock(callbackLock);
        pendingCallback = callback;
    }

    // Detect Master messages (M: prefix) vs Teacher messages
    bool isMasterMessage = userMessage.trimStart().startsWith("M:");
    pendingIsMasterMessage.store(isMasterMessage);

    waitingForResponse.store(true);
    writeMessage(userMessage, audioContext);
}

void ClaudeClient::writeMessage(const juce::String& message, const juce::String& context)
{
    auto outbox = new juce::DynamicObject();
    outbox->setProperty("timestamp", juce::Time::currentTimeMillis());
    outbox->setProperty("message", message);
    outbox->setProperty("audio_context", context);

    auto json = juce::JSON::toString(juce::var(outbox));
    getOutboxFile().replaceWithText(json);
}

void ClaudeClient::updateAudioAnalysis(const juce::String& analysisJson)
{
    getAnalysisFile().replaceWithText(analysisJson);
}

void ClaudeClient::setActionCallback(ActionCallback callback)
{
    juce::ScopedLock lock(callbackLock);
    actionCallback = callback;
}

void ClaudeClient::timerCallback()
{
    if (waitingForResponse.load())
    {
        checkForResponse();
    }
}

void ClaudeClient::checkForResponse()
{
    // Route to appropriate inbox based on message type
    bool isMasterMessage = pendingIsMasterMessage.load();
    auto inboxFile = isMasterMessage ? getMasterInboxFile() : getTeacherInboxFile();
    juce::int64& lastResponseTime = isMasterMessage ? lastMasterResponseTime : lastTeacherResponseTime;

    if (!inboxFile.existsAsFile())
        return;

    auto modTime = inboxFile.getLastModificationTime().toMilliseconds();
    if (modTime <= lastResponseTime)
        return;

    // New response available
    lastResponseTime = modTime;

    auto content = inboxFile.loadFileAsString();
    auto json = juce::JSON::parse(content);

    if (auto* obj = json.getDynamicObject())
    {
        auto response = obj->getProperty("response").toString();

        if (response.isNotEmpty())
        {
            waitingForResponse.store(false);

            ResponseCallback cb;
            ActionCallback actionCb;
            {
                juce::ScopedLock lock(callbackLock);
                cb = pendingCallback;
                actionCb = actionCallback;
                pendingCallback = nullptr;
            }

            // Execute actions if present
            if (actionCb && obj->hasProperty("actions"))
            {
                auto actions = obj->getProperty("actions");
                if (actions.isArray())
                {
                    for (int i = 0; i < actions.size(); ++i)
                    {
                        auto action = actions[i];
                        juce::MessageManager::callAsync([actionCb, action]() {
                            actionCb(action);
                        });
                    }
                }
            }

            // Send response to UI
            if (cb)
            {
                juce::MessageManager::callAsync([cb, response]() {
                    cb(response);
                });
            }
        }
    }
}
