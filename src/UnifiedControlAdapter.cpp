#include "UnifiedControlAdapter.h"

UnifiedControlAdapter::UnifiedControlAdapter(const juce::String& baseUrlStr)
    : baseUrl(baseUrlStr)
{
    // Check connection on startup
    checkConnection();
}

UnifiedControlAdapter::~UnifiedControlAdapter() = default;

void UnifiedControlAdapter::checkConnection()
{
    // Use thread pool for async check
    juce::Thread::launch([this]()
    {
        auto healthUrl = baseUrl.withNewSubPath("/health");
        auto stream = healthUrl.createInputStream(
            juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
                .withConnectionTimeoutMs(2000)
        );

        if (stream != nullptr)
        {
            auto response = stream->readEntireStreamAsString();
            auto json = juce::JSON::parse(response);

            if (json.hasProperty("status"))
            {
                connected.store(true);
                DBG("UnifiedControlAdapter: Connected to bridge");
            }
            else
            {
                connected.store(false);
            }
        }
        else
        {
            connected.store(false);
            DBG("UnifiedControlAdapter: Could not connect to bridge");
        }
    });
}

// Non-blocking cached state access
juce::var UnifiedControlAdapter::getCachedSession() const
{
    juce::ScopedLock lock(cacheLock);
    return sessionCache;
}

juce::var UnifiedControlAdapter::getCachedTrack(int trackIndex) const
{
    juce::ScopedLock lock(cacheLock);
    auto it = trackCaches.find(trackIndex);
    return it != trackCaches.end() ? it->second : juce::var();
}

juce::var UnifiedControlAdapter::getCachedDevice(int trackIndex, int deviceIndex) const
{
    juce::ScopedLock lock(cacheLock);
    auto key = std::make_pair(trackIndex, deviceIndex);
    auto it = deviceCaches.find(key);
    return it != deviceCaches.end() ? it->second : juce::var();
}

// Async delta queries
void UnifiedControlAdapter::fetchSessionDelta(ResponseCallback callback)
{
    asyncGet("/session/delta", [this, callback](const juce::var& result, bool success)
    {
        if (success && result.hasProperty("type"))
        {
            auto type = result["type"].toString();

            juce::ScopedLock lock(cacheLock);

            if (type == "full")
            {
                sessionCache = result["state"];
            }
            else if (type == "delta")
            {
                applyDelta(result, sessionCache);
            }
            // "no_change" - keep existing cache
        }

        if (callback)
            callback(result, success);
    });
}

void UnifiedControlAdapter::fetchTrackDelta(int trackIndex, ResponseCallback callback)
{
    auto endpoint = juce::String("/track/") + juce::String(trackIndex) + "/delta";

    asyncGet(endpoint, [this, trackIndex, callback](const juce::var& result, bool success)
    {
        if (success && result.hasProperty("type"))
        {
            auto type = result["type"].toString();

            juce::ScopedLock lock(cacheLock);

            if (type == "full")
            {
                trackCaches[trackIndex] = result["state"];
            }
            else if (type == "delta")
            {
                if (trackCaches.find(trackIndex) == trackCaches.end())
                    trackCaches[trackIndex] = juce::var();
                applyDelta(result, trackCaches[trackIndex]);
            }
        }

        if (callback)
            callback(result, success);
    });
}

void UnifiedControlAdapter::fetchDeviceDelta(int trackIndex, int deviceIndex, ResponseCallback callback)
{
    auto endpoint = juce::String("/track/") + juce::String(trackIndex)
                  + "/device/" + juce::String(deviceIndex) + "/delta";

    asyncGet(endpoint, [this, trackIndex, deviceIndex, callback](const juce::var& result, bool success)
    {
        if (success && result.hasProperty("type"))
        {
            auto type = result["type"].toString();
            auto key = std::make_pair(trackIndex, deviceIndex);

            juce::ScopedLock lock(cacheLock);

            if (type == "full")
            {
                deviceCaches[key] = result["state"];
            }
            else if (type == "delta")
            {
                if (deviceCaches.find(key) == deviceCaches.end())
                    deviceCaches[key] = juce::var();
                applyDelta(result, deviceCaches[key]);
            }
        }

        if (callback)
            callback(result, success);
    });
}

// Control commands
void UnifiedControlAdapter::setParameter(int trackIndex, int deviceIndex, int paramIndex, float value)
{
    auto endpoint = juce::String("/track/") + juce::String(trackIndex)
                  + "/device/" + juce::String(deviceIndex)
                  + "/parameter/" + juce::String(paramIndex);

    juce::DynamicObject::Ptr body = new juce::DynamicObject();
    body->setProperty("value", value);

    asyncPost(endpoint, juce::var(body.get()), nullptr);
}

void UnifiedControlAdapter::setTempo(float bpm)
{
    juce::DynamicObject::Ptr body = new juce::DynamicObject();
    body->setProperty("tempo", bpm);

    asyncPost("/transport/tempo", juce::var(body.get()), nullptr);
}

void UnifiedControlAdapter::startPlayback()
{
    asyncPost("/transport/play", juce::var(), nullptr);
}

void UnifiedControlAdapter::stopPlayback()
{
    asyncPost("/transport/stop", juce::var(), nullptr);
}

void UnifiedControlAdapter::fireClip(int trackIndex, int clipIndex)
{
    auto endpoint = juce::String("/track/") + juce::String(trackIndex)
                  + "/clip/" + juce::String(clipIndex) + "/fire";
    asyncPost(endpoint, juce::var(), nullptr);
}

void UnifiedControlAdapter::stopClip(int trackIndex, int clipIndex)
{
    auto endpoint = juce::String("/track/") + juce::String(trackIndex)
                  + "/clip/" + juce::String(clipIndex) + "/stop";
    asyncPost(endpoint, juce::var(), nullptr);
}

// Cache management
void UnifiedControlAdapter::resetCache(const juce::String& scope)
{
    juce::DynamicObject::Ptr body = new juce::DynamicObject();
    body->setProperty("scope", scope);

    asyncPost("/cache/reset", juce::var(body.get()), nullptr);

    // Also clear local caches
    juce::ScopedLock lock(cacheLock);
    if (scope == "all" || scope == "session")
        sessionCache = juce::var();
    if (scope == "all" || scope == "tracks")
        trackCaches.clear();
    if (scope == "all" || scope == "devices")
        deviceCaches.clear();
}

juce::var UnifiedControlAdapter::getCacheStats() const
{
    juce::DynamicObject::Ptr stats = new juce::DynamicObject();

    juce::ScopedLock lock(cacheLock);
    stats->setProperty("session_cached", !sessionCache.isVoid());
    stats->setProperty("track_caches", (int)trackCaches.size());
    stats->setProperty("device_caches", (int)deviceCaches.size());

    return juce::var(stats.get());
}

// HTTP helpers
void UnifiedControlAdapter::asyncGet(const juce::String& endpoint, ResponseCallback callback)
{
    auto url = baseUrl.withNewSubPath(endpoint);
    auto endpointCopy = endpoint;

    juce::Thread::launch([this, url, callback, endpointCopy]()
    {
        auto stream = url.createInputStream(
            juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
                .withConnectionTimeoutMs(5000)
        );

        if (stream != nullptr)
        {
            auto response = stream->readEntireStreamAsString();
            auto json = juce::JSON::parse(response);

            juce::MessageManager::callAsync([callback, json]()
            {
                if (callback)
                    callback(json, true);
            });
        }
        else
        {
            lastError = "GET request failed: " + endpointCopy;

            juce::MessageManager::callAsync([callback]()
            {
                if (callback)
                    callback(juce::var(), false);
            });
        }
    });
}

void UnifiedControlAdapter::asyncPost(const juce::String& endpoint, const juce::var& body, ResponseCallback callback)
{
    auto url = baseUrl.withNewSubPath(endpoint);

    // Add JSON body if provided
    if (!body.isVoid())
    {
        auto jsonBody = juce::JSON::toString(body);
        url = url.withPOSTData(jsonBody);
    }

    juce::Thread::launch([this, url, callback]()
    {
        auto stream = url.createInputStream(
            juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inPostData)
                .withConnectionTimeoutMs(5000)
                .withExtraHeaders("Content-Type: application/json")
        );

        if (stream != nullptr)
        {
            auto response = stream->readEntireStreamAsString();
            auto json = juce::JSON::parse(response);

            juce::MessageManager::callAsync([callback, json]()
            {
                if (callback)
                    callback(json, true);
            });
        }
        else
        {
            lastError = "POST request failed";

            juce::MessageManager::callAsync([callback]()
            {
                if (callback)
                    callback(juce::var(), false);
            });
        }
    });
}

juce::var UnifiedControlAdapter::syncGet(const juce::String& endpoint)
{
    auto url = baseUrl.withNewSubPath(endpoint);

    auto stream = url.createInputStream(
        juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inAddress)
            .withConnectionTimeoutMs(5000)
    );

    if (stream != nullptr)
    {
        auto response = stream->readEntireStreamAsString();
        return juce::JSON::parse(response);
    }

    lastError = "GET request failed: " + endpoint;
    return juce::var();
}

juce::var UnifiedControlAdapter::syncPost(const juce::String& endpoint, const juce::var& body)
{
    auto url = baseUrl.withNewSubPath(endpoint);

    if (!body.isVoid())
    {
        auto jsonBody = juce::JSON::toString(body);
        url = url.withPOSTData(jsonBody);
    }

    auto stream = url.createInputStream(
        juce::URL::InputStreamOptions(juce::URL::ParameterHandling::inPostData)
            .withConnectionTimeoutMs(5000)
            .withExtraHeaders("Content-Type: application/json")
    );

    if (stream != nullptr)
    {
        auto response = stream->readEntireStreamAsString();
        return juce::JSON::parse(response);
    }

    lastError = "POST request failed";
    return juce::var();
}

// Apply delta changes to cached state
void UnifiedControlAdapter::applyDelta(const juce::var& delta, juce::var& target)
{
    auto changes = delta["changes"];

    if (!changes.isArray())
        return;

    for (int i = 0; i < changes.size(); i++)
    {
        auto change = changes[i];
        auto path = change["path"].toString();
        auto type = change["type"].toString();

        // Simple path parsing (handles "key" and "key.subkey" formats)
        juce::StringArray pathParts;
        pathParts.addTokens(path, ".", "");

        if (pathParts.size() == 1)
        {
            // Top-level property
            if (type == "modified" || type == "added")
            {
                if (target.isObject())
                {
                    auto obj = target.getDynamicObject();
                    if (obj != nullptr)
                        obj->setProperty(pathParts[0], change["new_value"]);
                }
            }
            else if (type == "removed")
            {
                if (target.isObject())
                {
                    auto obj = target.getDynamicObject();
                    if (obj != nullptr)
                        obj->removeProperty(pathParts[0]);
                }
            }
        }
        // For deeper paths, we'd need recursive traversal
        // For now, handle the most common case (top-level changes)
    }
}
