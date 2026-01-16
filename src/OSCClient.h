#pragma once

#include <juce_osc/juce_osc.h>
#include <juce_core/juce_core.h>
#include <map>

class OSCClient : private juce::OSCReceiver::Listener<juce::OSCReceiver::RealtimeCallback>
{
public:
    OSCClient();
    ~OSCClient() override;

    bool connect();
    void disconnect();
    bool isConnected() const { return connected; }

    // Query Ableton state
    void requestSessionInfo();
    void requestTrackNames();
    juce::String getSessionInfo() const;

    // Cached session data
    float getTempo() const { return tempo.load(); }
    int getNumTracks() const { return numTracks.load(); }
    juce::String getTrackName(int index) const;
    int findTrackByName(const juce::String& name) const;

    // Commands
    void setTempo(float bpm);
    void play();
    void stop();
    void muteTrack(int trackIndex, bool mute);
    void soloTrack(int trackIndex, bool solo);
    void setTrackVolume(int trackIndex, float volume);  // 0.0 to 1.0
    void fireClip(int trackIndex, int clipIndex);
    void stopClip(int trackIndex, int clipIndex);
    void fireScene(int sceneIndex);

    // Execute action from JSON (e.g., {"action": "mute", "track": "Bass"})
    bool executeAction(const juce::var& action);

private:
    void oscMessageReceived(const juce::OSCMessage& message) override;
    void sendOSC(const juce::String& address);
    void sendOSC(const juce::String& address, float value);
    void sendOSC(const juce::String& address, int value);
    void sendOSC(const juce::String& address, int arg1, int arg2);

    juce::OSCSender sender;
    juce::OSCReceiver receiver;

    bool connected = false;

    // AbletonOSC default ports
    static constexpr int sendPort = 11000;
    static constexpr int receivePort = 11001;

    // Cached Ableton data
    std::atomic<float> tempo{120.0f};
    std::atomic<int> numTracks{0};
    std::map<int, juce::String> trackNamesMap;
    juce::CriticalSection dataLock;
};
