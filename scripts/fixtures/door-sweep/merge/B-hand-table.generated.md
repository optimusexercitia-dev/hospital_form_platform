| public.update_meeting(p_meeting_id uuid, p_title text, p_scheduled_start timestamp with time zone, p_modality text, p_meeting_type_id uuid, p_scheduled_end timestamp with time zone, p_location_text text, p_meeting_url text, p_minutes_md text) | invoker | open-guard | UNSUPPORTED | identity assert called in ASSIGNMENT form (`v := app.assert_*`) — no type-safe neutral value; any verdict here would be about a different guard |

## ERROR triage — neither is a blind spot

`ERROR` means the run shape differed from baseline, so the classifier refuses to call it
COVERED. That refusal is correct and deliberate; it is not a pass, so both are triaged
here by hand rather than left bare (CLAUDE.md §6 step 1: "`ERROR` is not a pass").

Both are **coverage-with-abort**: the suite DID go `Result: FAIL`, but a keystone raised
rather than failing cleanly, which aborted its file mid-plan and moved the test count off
baseline. The classifier cannot tell "a keystone failed an assertion" from "a keystone
blew up", and it should not guess.


Neither is allowlisted and neither is in the backlog: they carry a verdict (`ERROR`), which
is what ARM 3 requires, and the hand-reading above is what ARM 5 needs to not treat them as
un-keystoned.
