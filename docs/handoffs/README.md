# Handoffs — resume pointers only

A file here exists only while a session is **paused mid-task**: the resume pointer, the trust
level, the tree state, the next command — nothing else (ADR 0186 D3; the `handoff` skill writes
it). State lives in the unit's hub `docs/features/<code>.md` § Current state; witnesses live in
its progress record `docs/progress/<code>.md` § Session log. A handoff carries `branch:` when its
unit has a hub, else `expires:`; it is deleted on resume or at landing, never renamed. Gate 13's
HANDOFFS arm reds on a missing key, a past `expires:`, a vanished branch, a file over 24 KB, or an
inbound citation. This README keeps the directory in git when it is otherwise empty.
