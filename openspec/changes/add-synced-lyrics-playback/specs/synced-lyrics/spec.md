# Spec Delta

## Purpose

Shows a track's lyrics in time with playback, so the person always sees which line is being sung, with no waiting and no stutter.

## ADDED Requirements

### Requirement: One active line follows the playback position
The system SHALL mark as active the one lyric line whose time window contains the current playback position. A line's window starts at its timestamp and ends at the next timestamp. The active line SHALL be visibly highlighted and exposed to accessibility services as selected; no other line SHALL be.

#### Scenario: Paused at a position shows the matching line
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=41000&paused=1`
- **THEN** exactly one lyric line is active: line 6, "Light a candle, or curse the dark"
- **AND** every other line is shown as not selected

#### Scenario: Moving back in the song moves the highlight back
- **WHEN** the screen is paused at 0:41 on line 6 and the app receives `reactnativeuitest://player?track=dcye&at=21500&paused=1`
- **THEN** exactly one lyric line is active: line 2, "Weak knees, and fresh scars"

### Requirement: No active line outside the lyrics
The system SHALL mark no line as active while the playback position is before the first lyric timestamp, or at or after the end marker that closes the last line. Before the first line the lyrics SHALL show the first line in the middle of the view; after the last line they SHALL keep the last line there.

#### Scenario: Before the first line
- **WHEN** the screen is paused at 0:41 on line 6 and the app receives `reactnativeuitest://player?track=dcye&at=5000&paused=1`
- **THEN** no lyric line is active
- **AND** line 0 is the row closest to the vertical centre of the lyrics view

#### Scenario: After the last line
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=200000&paused=1`
- **THEN** no lyric line is active
- **AND** line 38 is the row closest to the vertical centre of the lyrics view

### Requirement: The highlight advances in order during playback
While a track plays, the system SHALL move the highlight forward through the lines in order, without skipping a line whose window is longer than one second and without ever moving backward unless the user or a deep link moves the position back.

#### Scenario: Three lines in order
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=35000&paused=1` and the user taps Play
- **THEN** over the 12 seconds after the tap, the active line starts at line 5 and goes to line 6 and then line 7
- **AND** at no point does a lower-numbered line become active again

### Requirement: The active line stays in the middle of the lyrics view
Within one second of a line becoming active, the system SHALL scroll the lyrics so that line is the row closest to the vertical centre of the lyrics view, with its centre between 30% and 70% of the view's height, for every line including the first and last. While the user drags or flings the lyrics, the system SHALL NOT scroll them; auto-scroll resumes at the next line change after the scroll comes to rest.

#### Scenario: Centred when opened paused
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=41000&paused=1`
- **THEN** line 6 is the row closest to the vertical centre of the lyrics view
- **AND** its centre is between 30% and 70% of the view's height

#### Scenario: First and last lines can be centred
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=11000&paused=1`, and then `reactnativeuitest://player?track=dcye&at=190000&paused=1`
- **THEN** line 0, and then line 38, is the row closest to the vertical centre of the lyrics view, with its centre between 30% and 70% of the view's height

#### Scenario: Centred while playing
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=35000&paused=1` and the user taps Play
- **THEN** within one second of each of lines 6 and 7 becoming active, that line is the row closest to the vertical centre of the lyrics view

#### Scenario: Auto-scroll does not fight the user
- **WHEN** the screen is paused at 0:41 and the user swipes the lyrics up and lets go
- **THEN** the lyrics stay where the user left them while paused
- **AND WHEN** the user taps Play and line 7 becomes active at 0:44
- **THEN** within one second line 7 is the row closest to the vertical centre of the lyrics view

### Requirement: Tap a line to jump to it
The system SHALL move playback to the start of a lyric line when the user taps that line, keeping the current play or pause state. The tapped line SHALL become the active line at once and be brought into the middle of the lyrics view. A drag or fling of the lyrics SHALL NOT count as a tap.

#### Scenario: Tap a later line while paused
- **WHEN** the screen is paused at 0:41 on line 6 and the user taps line 9, "And shake away the heat"
- **THEN** line 9 is the only line shown as selected
- **AND** the time label reads 0:54
- **AND** the button still shows "Play"

#### Scenario: Tap an earlier line while playing
- **WHEN** a track is playing past 0:41 and the user taps line 2, "Weak knees, and fresh scars"
- **THEN** line 2 is the only line shown as selected and is the row closest to the vertical centre of the lyrics view
- **AND** the button still shows "Pause"
- **AND** playback continues from 0:18: the time label reads 0:18 or 0:19, and within 3 seconds it is past 0:19

### Requirement: Lyrics keep moving while the app is busy
The lyric highlight and auto-scroll SHALL keep updating while the app's JavaScript thread is blocked, and the accessibility selected state SHALL match the playing line as soon as the thread is free again. Development builds SHALL accept a `stall` deep-link parameter (milliseconds, at most 10000) that blocks the JavaScript thread once playback has reached the requested position; other builds SHALL ignore it.

#### Scenario: Line change during a JavaScript stall
- **WHEN** a development build opens `reactnativeuitest://player?track=dcye&at=43000&stall=6000` and the playback position passes 0:44.6 while the stall is in progress
- **THEN** a single reading of the screen shows line 7 as the row closest to the vertical centre of the lyrics view while line 6 is still the line shown as selected
- **AND** after the stall ends, the only line shown as selected is the one matching the playing position (line 7 or line 8)

### Requirement: Lyrics are ready with no loading state
The system SHALL show a track's lyrics as soon as its Now Playing screen appears, including when a deep link switches the screen to another track, and SHALL never show a loading indicator for lyrics of bundled tracks.

#### Scenario: Lyrics present when the screen opens
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&paused=1`
- **THEN** the lyric lines are visible as soon as the screen appears
- **AND** no loading indicator is shown

#### Scenario: Switching tracks shows the new lyrics at once
- **WHEN** the screen shows `dcye` and the app receives `reactnativeuitest://player?track=letting-go&paused=1`
- **THEN** the title changes to "I'm Letting Go" and its lyric lines are visible as soon as the title changes
- **AND** none of the previous track's lines remain
- **AND** no loading indicator is shown

### Requirement: Tracks without lyrics
The system SHALL show the message "No lyrics for this track" in place of the lyrics for a track that has none, with no line active and no loading indicator.

#### Scenario: Track with no lyrics
- **WHEN** the app opens `reactnativeuitest://player?track=tone&paused=1`
- **THEN** the lyrics area shows "No lyrics for this track"
- **AND** no lyric line is shown or active
