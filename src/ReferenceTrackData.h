#pragma once

#include <juce_core/juce_core.h>
#include <juce_graphics/juce_graphics.h>
#include <vector>

struct Segment
{
    float startSeconds;
    float endSeconds;
    juce::String label;
    bool isTransition;
    juce::Colour color;
};

struct HierarchyLevel
{
    int level;
    std::vector<Segment> segments;
};

struct ReferenceTrackData
{
    juce::String filePath;
    float durationSeconds = 0.0f;
    float tempoBpm = 120.0f;
    std::vector<HierarchyLevel> levels;
    int currentLevel = 0;

    bool isLoaded() const { return !filePath.isEmpty() && !levels.empty(); }

    const std::vector<Segment>& getCurrentSegments() const
    {
        if (currentLevel >= 0 && currentLevel < levels.size())
            return levels[currentLevel].segments;
        static std::vector<Segment> empty;
        return empty;
    }

    static ReferenceTrackData fromJson(const juce::String& json, const juce::String& filePath);
};
