#include "ReferenceTrackData.h"

namespace
{
    juce::Colour getRainbowColor(float position)
    {
        // Position 0-1 maps to rainbow (red -> violet)
        float hue = position * 0.8f; // 0 to 0.8 covers red to violet
        return juce::Colour::fromHSV(hue, 0.7f, 0.9f, 1.0f);
    }
}

ReferenceTrackData ReferenceTrackData::fromJson(const juce::String& json, const juce::String& filePath)
{
    ReferenceTrackData data;
    data.filePath = filePath;

    auto parsed = juce::JSON::parse(json);
    if (parsed.isVoid())
        return data;

    auto* obj = parsed.getDynamicObject();
    if (!obj)
        return data;

    data.durationSeconds = static_cast<float>(obj->getProperty("duration_seconds"));
    data.tempoBpm = static_cast<float>(obj->getProperty("tempo_bpm"));

    auto levelsArray = obj->getProperty("levels");
    if (levelsArray.isArray())
    {
        for (int i = 0; i < levelsArray.size(); ++i)
        {
            auto levelObj = levelsArray[i].getDynamicObject();
            if (!levelObj)
                continue;

            HierarchyLevel level;
            level.level = static_cast<int>(levelObj->getProperty("level"));

            auto segmentsArray = levelObj->getProperty("segments");
            if (segmentsArray.isArray())
            {
                int numSegments = segmentsArray.size();
                for (int j = 0; j < numSegments; ++j)
                {
                    auto segObj = segmentsArray[j].getDynamicObject();
                    if (!segObj)
                        continue;

                    Segment seg;
                    seg.startSeconds = static_cast<float>(segObj->getProperty("start"));
                    seg.endSeconds = static_cast<float>(segObj->getProperty("end"));
                    seg.label = segObj->getProperty("label").toString();
                    seg.isTransition = static_cast<bool>(segObj->getProperty("is_transition"));
                    seg.color = getRainbowColor(static_cast<float>(j) / static_cast<float>(numSegments));

                    level.segments.push_back(seg);
                }
            }

            data.levels.push_back(level);
        }
    }

    return data;
}
