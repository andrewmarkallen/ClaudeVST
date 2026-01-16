#include "OSCClient.h"

OSCClient::OSCClient()
{
}

OSCClient::~OSCClient()
{
    disconnect();
}

bool OSCClient::connect()
{
    if (connected)
        return true;

    // Connect sender to AbletonOSC
    if (!sender.connect("127.0.0.1", sendPort))
        return false;

    // Start receiver for responses
    if (!receiver.connect(receivePort))
    {
        sender.disconnect();
        return false;
    }

    receiver.addListener(this);
    connected = true;

    // Request initial session info
    requestSessionInfo();

    return true;
}

void OSCClient::disconnect()
{
    if (!connected)
        return;

    receiver.removeListener(this);
    receiver.disconnect();
    sender.disconnect();
    connected = false;
}

void OSCClient::requestSessionInfo()
{
    if (!connected)
        return;

    sendOSC("/live/song/get/tempo");
    sendOSC("/live/song/get/num_tracks");
    requestTrackNames();
}

void OSCClient::requestTrackNames()
{
    if (!connected)
        return;

    int tracks = numTracks.load();
    for (int i = 0; i < tracks; ++i)
    {
        juce::OSCMessage msg(juce::OSCAddressPattern("/live/track/get/name"));
        msg.addInt32(i);
        sender.send(msg);
    }
}

void OSCClient::sendOSC(const juce::String& address)
{
    sender.send(juce::OSCMessage(juce::OSCAddressPattern(address)));
}

void OSCClient::sendOSC(const juce::String& address, float value)
{
    juce::OSCAddressPattern pattern(address);
    juce::OSCMessage msg(pattern);
    msg.addFloat32(value);
    sender.send(msg);
}

void OSCClient::sendOSC(const juce::String& address, int value)
{
    juce::OSCAddressPattern pattern(address);
    juce::OSCMessage msg(pattern);
    msg.addInt32(value);
    sender.send(msg);
}

void OSCClient::sendOSC(const juce::String& address, int arg1, int arg2)
{
    juce::OSCAddressPattern pattern(address);
    juce::OSCMessage msg(pattern);
    msg.addInt32(arg1);
    msg.addInt32(arg2);
    sender.send(msg);
}

void OSCClient::oscMessageReceived(const juce::OSCMessage& message)
{
    auto address = message.getAddressPattern().toString();

    if (address == "/live/song/get/tempo" && message.size() > 0)
    {
        if (message[0].isFloat32())
            tempo.store(message[0].getFloat32());
    }
    else if (address == "/live/song/get/num_tracks" && message.size() > 0)
    {
        if (message[0].isInt32())
        {
            numTracks.store(message[0].getInt32());
            // Request track names now that we know how many there are
            requestTrackNames();
        }
    }
    else if (address == "/live/track/get/name" && message.size() >= 2)
    {
        juce::ScopedLock lock(dataLock);
        if (message[0].isInt32() && message[1].isString())
        {
            int trackIndex = message[0].getInt32();
            trackNamesMap[trackIndex] = message[1].getString();
        }
    }
}

juce::String OSCClient::getSessionInfo() const
{
    juce::String info;
    info += "Tempo: " + juce::String(tempo.load(), 1) + " BPM\n";
    info += "Tracks: " + juce::String(numTracks.load()) + "\n";

    {
        juce::ScopedLock lock(dataLock);
        if (!trackNamesMap.empty())
        {
            info += "Track names:\n";
            for (const auto& pair : trackNamesMap)
            {
                info += "  " + juce::String(pair.first) + ": " + pair.second + "\n";
            }
        }
    }

    return info;
}

juce::String OSCClient::getTrackName(int index) const
{
    juce::ScopedLock lock(dataLock);
    auto it = trackNamesMap.find(index);
    if (it != trackNamesMap.end())
        return it->second;
    return {};
}

int OSCClient::findTrackByName(const juce::String& name) const
{
    juce::ScopedLock lock(dataLock);
    juce::String searchLower = name.toLowerCase();

    for (const auto& pair : trackNamesMap)
    {
        if (pair.second.toLowerCase().contains(searchLower))
            return pair.first;
    }
    return -1;  // Not found
}

// Commands
void OSCClient::setTempo(float bpm)
{
    if (!connected) return;
    sendOSC("/live/song/set/tempo", bpm);
    tempo.store(bpm);
}

void OSCClient::play()
{
    if (!connected) return;
    sendOSC("/live/song/start_playing");
}

void OSCClient::stop()
{
    if (!connected) return;
    sendOSC("/live/song/stop_playing");
}

void OSCClient::muteTrack(int trackIndex, bool mute)
{
    if (!connected) return;
    sendOSC("/live/track/set/mute", trackIndex, mute ? 1 : 0);
}

void OSCClient::soloTrack(int trackIndex, bool solo)
{
    if (!connected) return;
    sendOSC("/live/track/set/solo", trackIndex, solo ? 1 : 0);
}

void OSCClient::setTrackVolume(int trackIndex, float volume)
{
    if (!connected) return;
    // Volume is 0.0 to 1.0, where 0.85 ≈ 0dB
    juce::OSCMessage msg(juce::OSCAddressPattern("/live/track/set/volume"));
    msg.addInt32(trackIndex);
    msg.addFloat32(volume);
    sender.send(msg);
}

void OSCClient::fireClip(int trackIndex, int clipIndex)
{
    if (!connected) return;
    juce::OSCMessage msg(juce::OSCAddressPattern("/live/clip/fire"));
    msg.addInt32(trackIndex);
    msg.addInt32(clipIndex);
    sender.send(msg);
}

void OSCClient::stopClip(int trackIndex, int clipIndex)
{
    if (!connected) return;
    juce::OSCMessage msg(juce::OSCAddressPattern("/live/clip/stop"));
    msg.addInt32(trackIndex);
    msg.addInt32(clipIndex);
    sender.send(msg);
}

void OSCClient::fireScene(int sceneIndex)
{
    if (!connected) return;
    juce::OSCMessage msg(juce::OSCAddressPattern("/live/scene/fire"));
    msg.addInt32(sceneIndex);
    sender.send(msg);
}

bool OSCClient::executeAction(const juce::var& action)
{
    if (!connected || !action.isObject())
        return false;

    auto* obj = action.getDynamicObject();
    if (!obj) return false;

    juce::String actionType = obj->getProperty("action").toString().toLowerCase();

    if (actionType == "play")
    {
        play();
        return true;
    }
    else if (actionType == "stop")
    {
        stop();
        return true;
    }
    else if (actionType == "tempo" || actionType == "set_tempo")
    {
        float bpm = static_cast<float>(obj->getProperty("value"));
        if (bpm > 20.0f && bpm < 999.0f)
        {
            setTempo(bpm);
            return true;
        }
    }
    else if (actionType == "mute")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);

        if (trackIndex >= 0)
        {
            muteTrack(trackIndex, true);
            return true;
        }
    }
    else if (actionType == "unmute")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);

        if (trackIndex >= 0)
        {
            muteTrack(trackIndex, false);
            return true;
        }
    }
    else if (actionType == "solo")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);

        if (trackIndex >= 0)
        {
            soloTrack(trackIndex, true);
            return true;
        }
    }
    else if (actionType == "unsolo")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);

        if (trackIndex >= 0)
        {
            soloTrack(trackIndex, false);
            return true;
        }
    }
    else if (actionType == "volume")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);
        float volume = static_cast<float>(obj->getProperty("value"));

        if (trackIndex >= 0 && volume >= 0.0f && volume <= 1.0f)
        {
            setTrackVolume(trackIndex, volume);
            return true;
        }
    }
    else if (actionType == "fire_clip" || actionType == "start_clip" || actionType == "play_clip")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);
        int clipIndex = obj->hasProperty("clip_index")
            ? static_cast<int>(obj->getProperty("clip_index"))
            : 0;  // Default to first clip

        if (trackIndex >= 0)
        {
            fireClip(trackIndex, clipIndex);
            return true;
        }
    }
    else if (actionType == "stop_clip")
    {
        juce::String trackName = obj->getProperty("track").toString();
        int trackIndex = obj->hasProperty("track_index")
            ? static_cast<int>(obj->getProperty("track_index"))
            : findTrackByName(trackName);
        int clipIndex = obj->hasProperty("clip_index")
            ? static_cast<int>(obj->getProperty("clip_index"))
            : 0;

        if (trackIndex >= 0)
        {
            stopClip(trackIndex, clipIndex);
            return true;
        }
    }
    else if (actionType == "fire_scene" || actionType == "play_scene")
    {
        int sceneIndex = static_cast<int>(obj->getProperty("scene_index"));
        fireScene(sceneIndex);
        return true;
    }

    return false;
}
