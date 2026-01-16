#include "DockerRunner.h"

bool DockerRunner::isDockerAvailable()
{
    juce::ChildProcess process;
    if (process.start("docker --version"))
    {
        process.waitForProcessToFinish(5000);
        return process.getExitCode() == 0;
    }
    return false;
}

void DockerRunner::runMsafAnalysis(const juce::String& audioFilePath, CompletionCallback callback)
{
    // Run in background thread
    std::thread([audioFilePath, callback]()
    {
        if (!isDockerAvailable())
        {
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Docker is not available. Please install and start Docker.");
            });
            return;
        }

        // Build docker command
        juce::File audioFile(audioFilePath);
        if (!audioFile.existsAsFile())
        {
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Audio file not found.");
            });
            return;
        }

        juce::String parentDir = audioFile.getParentDirectory().getFullPathName();
        juce::String fileName = audioFile.getFileName();

        juce::String command = "docker run --rm -v \"" + parentDir + ":/audio\" msaf-analyzer /audio/" + fileName;

        juce::ChildProcess process;
        if (!process.start(command))
        {
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Failed to start Docker process.");
            });
            return;
        }

        // Wait for completion (timeout after 60 seconds)
        if (!process.waitForProcessToFinish(60000))
        {
            process.kill();
            juce::MessageManager::callAsync([callback]()
            {
                callback(false, "Analysis timed out.");
            });
            return;
        }

        juce::String output = process.readAllProcessOutput();
        int exitCode = process.getExitCode();

        juce::MessageManager::callAsync([callback, exitCode, output]()
        {
            callback(exitCode == 0, output);
        });

    }).detach();
}
