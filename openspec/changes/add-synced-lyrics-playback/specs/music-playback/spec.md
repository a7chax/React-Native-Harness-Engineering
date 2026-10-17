# Spec Delta

## Purpose

Lets a person play songs from the app's bundled catalog on a Now Playing screen, control playback, see where they are in the song, and see who made the music.

## ADDED Requirements

### Requirement: Open a bundled track on the Now Playing screen
The system SHALL open a track from the bundled catalog on the Now Playing screen, identified by its catalog id, and show its title and artist. Opening the screen without a valid track id SHALL show the first track in the catalog. The screen SHALL be reachable by the deep link `reactnativeuitest://player` without logging in.

#### Scenario: Open a track by id
- **WHEN** the app opens `reactnativeuitest://player?track=dcye`
- **THEN** the Now Playing screen shows the title "Don't Close Your Eyes" and the artist "Josh Woodward"

#### Scenario: Unknown track id falls back to the first track
- **WHEN** the app opens `reactnativeuitest://player?track=does-not-exist`
- **THEN** the Now Playing screen shows the first track in the catalog
- **AND** no error screen is shown

### Requirement: Play and pause
The system SHALL start playback when the user taps Play and pause it when the user taps Pause, keeping the playback position. The button SHALL show "Pause" while playing and "Play" while paused.

#### Scenario: Pause keeps the position
- **WHEN** a track is playing and the user taps Pause
- **THEN** the button shows "Play"
- **AND** once the button shows "Play", the time label does not change over the next 2 seconds

#### Scenario: Resume from the same position
- **WHEN** a track is paused at 0:41 and the user taps Play
- **THEN** the button shows "Pause"
- **AND** the time label reads 0:41 or 0:42 and never less than 0:41
- **AND** within 2 seconds the time label is past 0:41

### Requirement: Playback time display
The system SHALL show the playback position rounded down to whole seconds as `m:ss`. While the app is responsive, the label SHALL move to the next second within half a second of the position crossing it. The development-only `stall` parameter is exempt.

#### Scenario: Time label while playing
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=35000&paused=1` and the user taps Play
- **THEN** the time label reads 0:35 before the tap
- **AND** 12 seconds after the tap it reads 0:47, give or take one second

### Requirement: Start position and paused state from the deep link
The system SHALL accept the optional deep-link parameters `at` (start position in milliseconds) and `paused` (`1` to stay paused). Without `paused=1`, playback SHALL start immediately. It SHALL ignore an `at` that is not a number, is negative, or is past the end of the track, and start from 0:00. Parameters SHALL apply when the screen opens and whenever a deep link arrives while it is open, even one identical to the current link.

#### Scenario: Open paused at a position
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=41000&paused=1`
- **THEN** the track is paused at 0:41
- **AND** the button shows "Play"

#### Scenario: A new deep link moves the position
- **WHEN** the Now Playing screen is paused at 0:41 and the app receives `reactnativeuitest://player?track=dcye&at=21500&paused=1`
- **THEN** the track is paused at 0:21

#### Scenario: The same deep link again re-applies it
- **WHEN** the screen was opened with `reactnativeuitest://player?track=dcye&at=41000&paused=1`, the user taps Play, and the app receives that same link again
- **THEN** the track is paused at 0:41 again
- **AND** the button shows "Play"

#### Scenario: Invalid position is ignored
- **WHEN** the app opens `reactnativeuitest://player?track=dcye&at=-5&paused=1`, or with `at=abc`, or with `at=999999999`
- **THEN** the track is paused at 0:00
- **AND** no error screen is shown

### Requirement: Music attribution
The system SHALL show, on the Now Playing screen, the attribution each bundled track's license requires: title, artist, license name, and a note of any change made to the original, such as transcoding. Tapping the credit SHALL show the license's web address and a link to the original song page, each of which opens in the browser when tapped.

#### Scenario: CC BY track shows its credit
- **WHEN** the Now Playing screen shows "Don't Close Your Eyes"
- **THEN** it shows the credit `Music: "Don't Close Your Eyes" by Josh Woodward, CC BY 4.0, transcoded to AAC`

#### Scenario: Credit links to the license and the original song
- **WHEN** the Now Playing screen shows "Don't Close Your Eyes" and the user taps the credit
- **THEN** a credits panel shows the license address `https://creativecommons.org/licenses/by/4.0/` and the song page `https://www.joshwoodward.com/song/DontCloseYourEyes`
- **AND** tapping the license address opens it in the browser
- **AND** closing the panel returns to the lyrics
