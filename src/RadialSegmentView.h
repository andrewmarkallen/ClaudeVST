#pragma once

#include <juce_gui_basics/juce_gui_basics.h>
#include "ReferenceTrackData.h"

class RadialSegmentView : public juce::Component
{
public:
    RadialSegmentView();

    void setData(const ReferenceTrackData* data);
    void paint(juce::Graphics& g) override;
    void resized() override;
    void mouseMove(const juce::MouseEvent& event) override;

private:
    const ReferenceTrackData* trackData = nullptr;
    int hoveredSegment = -1;

    juce::Rectangle<float> getArcBounds() const;
    int getSegmentAtPoint(juce::Point<float> point) const;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(RadialSegmentView)
};
