import { minutesTo12HourTime } from "./app/lib/schedule";

for (const m of [0, 540, 736, 840]) {
  console.log(m, "→", minutesTo12HourTime(m));
}
