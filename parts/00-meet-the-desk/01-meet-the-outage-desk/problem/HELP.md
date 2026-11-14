# Help: Meet the outage desk

## If you get stuck

| What you see                               | Fix                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `FAIL first-look.md exists`                | Put the file in this `problem/` folder, next to this README.                         |
| `FAIL ... matches the board`               | Copy the number after the label. `92%` and `92` both work. So do `$0.15` and `0.15`. |
| `FAIL The job you think needs an agent`    | Write a job id such as `plan-the-crews`, not a description.                          |
| The storm run stops with a No recorded reply message | Someone changed the sample prompts. Run `git checkout finished/` to bring them back. |

## Words you will use

- **OMS**: the outage management system. It is Copperbeck's true record of every outage.
- **Replay**: the model replies were saved once and are played back. You need no key, and it costs nothing.
- **Board**: the summary that code builds from the OMS and the logs, never from what a model said.
- **Must-never**: an action the system may never take. Here, it is closing an outage while homes are still
  dark.
- **Agent**: a loop where the model picks the next step and calls tools until it decides it is done.
