#include "RadialSegmentView.h"

RadialSegmentView::RadialSegmentView()
{
    setMouseCursor(juce::MouseCursor::PointingHandCursor);
}

void RadialSegmentView::setData(const ReferenceTrackData* data)
{
    trackData = data;
    repaint();
}

juce::Rectangle<float> RadialSegmentView::getArcBounds() const
{
    auto bounds = getLocalBounds().toFloat().reduced(10);
    float size = juce::jmin(bounds.getWidth(), bounds.getHeight());
    return bounds.withSizeKeepingCentre(size, size);
}

void RadialSegmentView::paint(juce::Graphics& g)
{
    auto arcBounds = getArcBounds();
    float centerX = arcBounds.getCentreX();
    float centerY = arcBounds.getCentreY();
    float radius = arcBounds.getWidth() / 2.0f;

    // Background circle
    g.setColour(juce::Colour(0xff2a2a2a));
    g.fillEllipse(arcBounds);

    if (!trackData || !trackData->isLoaded())
    {
        g.setColour(juce::Colours::grey);
        g.drawText("No track loaded", arcBounds, juce::Justification::centred);
        return;
    }

    // Draw segments as arcs
    const auto& segments = trackData->getCurrentSegments();
    float totalDuration = trackData->durationSeconds;

    float startAngle = -juce::MathConstants<float>::halfPi; // Start at top

    for (int i = 0; i < segments.size(); ++i)
    {
        const auto& seg = segments[i];
        float segmentDuration = seg.endSeconds - seg.startSeconds;
        float sweepAngle = (segmentDuration / totalDuration) * juce::MathConstants<float>::twoPi;

        juce::Path arc;
        arc.addPieSegment(arcBounds, startAngle, startAngle + sweepAngle, 0.5f);

        // Highlight hovered segment
        juce::Colour fillColor = seg.color;
        if (i == hoveredSegment)
            fillColor = fillColor.brighter(0.3f);
        if (seg.isTransition)
            fillColor = fillColor.withAlpha(0.6f);

        g.setColour(fillColor);
        g.fillPath(arc);

        // Draw segment border
        g.setColour(juce::Colours::black.withAlpha(0.3f));
        g.strokePath(arc, juce::PathStrokeType(1.0f));

        // Draw label for larger segments
        if (sweepAngle > 0.3f)
        {
            float labelAngle = startAngle + sweepAngle / 2.0f;
            float labelRadius = radius * 0.75f;
            float labelX = centerX + std::cos(labelAngle) * labelRadius;
            float labelY = centerY + std::sin(labelAngle) * labelRadius;

            g.setColour(juce::Colours::white);
            g.setFont(12.0f);
            g.drawText(seg.label,
                       juce::Rectangle<float>(labelX - 40, labelY - 10, 80, 20),
                       juce::Justification::centred);
        }

        startAngle += sweepAngle;
    }

    // Draw hover tooltip
    if (hoveredSegment >= 0 && hoveredSegment < segments.size())
    {
        const auto& seg = segments[hoveredSegment];
        int startMins = static_cast<int>(seg.startSeconds) / 60;
        int startSecs = static_cast<int>(seg.startSeconds) % 60;
        int endMins = static_cast<int>(seg.endSeconds) / 60;
        int endSecs = static_cast<int>(seg.endSeconds) % 60;

        juce::String tooltip = seg.label + juce::String::formatted(": %d:%02d - %d:%02d",
                                                                    startMins, startSecs,
                                                                    endMins, endSecs);
        if (seg.isTransition)
            tooltip += " [transition]";

        g.setColour(juce::Colours::white);
        g.setFont(11.0f);
        g.drawText(tooltip, getLocalBounds().removeFromBottom(20), juce::Justification::centred);
    }
}

void RadialSegmentView::resized()
{
    repaint();
}

int RadialSegmentView::getSegmentAtPoint(juce::Point<float> point) const
{
    if (!trackData || !trackData->isLoaded())
        return -1;

    auto arcBounds = getArcBounds();
    float centerX = arcBounds.getCentreX();
    float centerY = arcBounds.getCentreY();
    float radius = arcBounds.getWidth() / 2.0f;

    float dx = point.x - centerX;
    float dy = point.y - centerY;
    float distance = std::sqrt(dx * dx + dy * dy);

    // Check if within donut (0.5 to 1.0 of radius)
    if (distance < radius * 0.5f || distance > radius)
        return -1;

    // Calculate angle
    float angle = std::atan2(dy, dx);
    // Normalize to 0-2π starting from top
    angle += juce::MathConstants<float>::halfPi;
    if (angle < 0)
        angle += juce::MathConstants<float>::twoPi;

    // Find segment
    const auto& segments = trackData->getCurrentSegments();
    float totalDuration = trackData->durationSeconds;
    float currentAngle = 0.0f;

    for (int i = 0; i < segments.size(); ++i)
    {
        const auto& seg = segments[i];
        float segmentDuration = seg.endSeconds - seg.startSeconds;
        float sweepAngle = (segmentDuration / totalDuration) * juce::MathConstants<float>::twoPi;

        if (angle >= currentAngle && angle < currentAngle + sweepAngle)
            return i;

        currentAngle += sweepAngle;
    }

    return -1;
}

void RadialSegmentView::mouseMove(const juce::MouseEvent& event)
{
    int newHovered = getSegmentAtPoint(event.position);
    if (newHovered != hoveredSegment)
    {
        hoveredSegment = newHovered;
        repaint();
    }
}
