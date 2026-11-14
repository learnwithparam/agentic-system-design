# Help: Map the memory

## If you get stuck

| What you see                                          | Fix                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `FAIL every record in Outcome and every object ...`   | Add a fact named after the missing record, such as `calls`.            |
| `FAIL no long-term note holds a record the OMS owns`  | Move that fact to `system-of-record`. The OMS is the one place for it. |
| `FAIL every long-term note has a writer and a reader` | Name a job such as `plan-the-crews` as the reader.                     |

## Words you will use

- **Context**: the text the model reads on one call. It is gone after the call.
- **Run state**: what one run has done so far, kept where a restart can read it.
- **Notes**: lessons kept across runs, such as how long fuse repairs took on past storms.
- **System of record**: the one place that holds the truth. At Copperbeck it is the OMS.
- **Two sources of truth**: one fact kept in two places.
