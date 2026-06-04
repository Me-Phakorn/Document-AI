# EasyPanel Recovery Artifacts

Source files used to rebuild `Docs/easypanel-recovery-checklist.md` after the EasyPanel LMDB was corrupted on 2026-06-04.

| File | Description | Size |
|---|---|---|
| `easypanel-lmdb-strings.txt` | Raw `strings -n 4` dump of the corrupted `data.mdb` | ~35 KB |
| `easypanel-lmdb-entries.json` | Parsed key→JSON map (33 keys recovered) | ~14 KB |
| `easypanel-actions-history.txt` | Raw `strings -n 4` dump of `data.sdb` (SQLite `actions` table — deployment/audit history 2025-04 onward) | ~56 KB |

**Server-side backups (still intact):**
- `/etc/easypanel/data.bak.1780592462/` — original snapshot
- `/etc/easypanel/data.corrupted.1780592682/` — copy moved aside before `easypanel setup`

If recovery via UI checklist fails, you can re-attempt automated injection by writing a Node.js script that uses the `lmdb` + `msgpackr` npm packages (already inside the `easypanel/easypanel:2.31.0-canary` image at `/app/node_modules`) to `.put()` each entry from `easypanel-lmdb-entries.json` into a fresh `data.mdb`. Stop the `easypanel` service first, run the script with the data dir mounted, then start the service.
