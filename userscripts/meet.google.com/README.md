# Google Meet Userscripts

This directory contains two public userscripts for Google Meet calls, one for joining muted and one for leaving an emptied call.

## Google Meet - Auto Mute on Join

Turns off the microphone and camera when you join a meeting.

### What it does

- clicks "Turn off microphone" and "Turn off camera" on the pre-join or in-meeting screen
- clicks each control once, then stops
- gives up after 30 seconds

## Google Meet - Auto Leave on Empty

Warns you when the call empties out and gives you a short countdown before leaving.

### What it does

- starts watching 15 seconds after the call UI appears, then reads the participant count every 5 seconds
- baseline is the highest count seen since monitoring started
- prompts when you are alone and the baseline was more than 1
- prompts when the baseline is 6 or more and at least 2 people drop, making up 50% or more of the previous count
- shows a 3 second overlay with "Stay in meeting" and plays a short tone
- clicks "Leave call" when the countdown ends; cancelling resets the baseline

### Limitations

- the participant count comes from page text and a hard-coded element id, so Meet markup changes can break it
