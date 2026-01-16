#include "UnifiedBridgeClient.h"
#include <thread>

juce::String UnifiedBridgeClient::baseUrl = "http://localhost:9100";

void UnifiedBridgeClient::setBaseUrl(const juce::String& url)
{
    baseUrl = url;
}

void UnifiedBridgeClient::sendCommand(const juce::String& command, const juce::var& args, ResponseCallback callback)
{
    // Run HTTP request in background thread
    std::thread([command, args, callback]()
    {
        juce::URL url(baseUrl + "/command");

        auto* requestObj = new juce::DynamicObject();
        requestObj->setProperty("command", command);
        requestObj->setProperty("args", args);

        auto postData = juce::JSON::toString(juce::var(requestObj));

        url = url.withPOSTData(postData);

        juce::String response;
        auto options = juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inPostData)
            .withExtraHeaders("Content-Type: application/json")
            .withConnectionTimeoutMs(5000);

        if (auto stream = url.createInputStream(options))
        {
            response = stream->readEntireStreamAsString();
        }

        juce::MessageManager::callAsync([callback, response]()
        {
            if (response.isEmpty())
            {
                callback(false, juce::var());
                return;
            }

            auto parsed = juce::JSON::parse(response);
            bool success = !parsed.isVoid();
            if (success)
            {
                auto* obj = parsed.getDynamicObject();
                if (obj && obj->hasProperty("error"))
                    success = false;
            }
            callback(success, parsed);
        });

    }).detach();
}

void UnifiedBridgeClient::createAudioTrack(int index, ResponseCallback callback)
{
    auto* args = new juce::DynamicObject();
    args->setProperty("index", index);
    sendCommand("create_audio_track", juce::var(args), callback);
}

void UnifiedBridgeClient::setTrackName(int trackIndex, const juce::String& name, ResponseCallback callback)
{
    auto* args = new juce::DynamicObject();
    args->setProperty("track_index", trackIndex);
    args->setProperty("name", name);
    sendCommand("set_track_name", juce::var(args), callback);
}

void UnifiedBridgeClient::createAudioClipSession(int trackIndex, int clipIndex, const juce::String& filePath, ResponseCallback callback)
{
    auto* args = new juce::DynamicObject();
    args->setProperty("track_index", trackIndex);
    args->setProperty("clip_index", clipIndex);
    args->setProperty("file_path", filePath);
    sendCommand("create_audio_clip_session", juce::var(args), callback);
}

void UnifiedBridgeClient::setClipName(int trackIndex, int clipIndex, const juce::String& name, ResponseCallback callback)
{
    auto* args = new juce::DynamicObject();
    args->setProperty("track_index", trackIndex);
    args->setProperty("clip_index", clipIndex);
    args->setProperty("name", name);
    sendCommand("set_clip_name", juce::var(args), callback);
}

void UnifiedBridgeClient::setClipColor(int trackIndex, int clipIndex, int colorIndex, ResponseCallback callback)
{
    auto* args = new juce::DynamicObject();
    args->setProperty("track_index", trackIndex);
    args->setProperty("clip_index", clipIndex);
    args->setProperty("color_index", colorIndex);
    sendCommand("set_clip_color", juce::var(args), callback);
}

void UnifiedBridgeClient::createAudioClipArrangement(int trackIndex, const juce::String& filePath, float positionBeats, ResponseCallback callback)
{
    auto* args = new juce::DynamicObject();
    args->setProperty("track_index", trackIndex);
    args->setProperty("file_path", filePath);
    args->setProperty("position", positionBeats);
    sendCommand("create_audio_clip_arrangement", juce::var(args), callback);
}
