// Story mode — "The Vanguard Trail". Original lore, no real-world references.
//
// You're the newest driver of the Trailblazer Expedition, charting an uncharted
// frontier. Years ago another team — the VANGUARD — vanished out here. Their
// trail of wrecks, black boxes and journals leads across every region, and the
// readings they left behind say the sleeping volcano is waking up.

export type Objective =
  | { kind: "reach"; target: [number, number]; radius: number; minY?: number; hint: string }
  | { kind: "bigair"; seconds: number; hint: string }
  | { kind: "collect"; points: [number, number][]; hint: string }
  | { kind: "gates"; points: [number, number][]; hint: string };

export interface Chapter {
  n: number; // 1-based order; unlocked when story_progress >= n-1
  id: string;
  title: string;
  act: string;
  region: string;
  blurb: string; // shown in the garage list
  intro: { speaker: string; text: string }; // briefing shown when the chapter starts
  outro: { speaker: string; text: string }; // debrief shown on completion
  objectives: Objective[]; // completed in order
  reward: number; // credits on first completion (mirror tb_story_complete SQL)
  spawn: [number, number];
}

const MARA = "Mara Voss — Expedition Lead";
const RIG = "Old Rig — Chief Mechanic";
const JUNO = "Juno — Signals";

export const CHAPTERS: Chapter[] = [
  // ===================== ACT I — THE NEW DRIVER =====================
  {
    n: 1,
    id: "first-tracks",
    title: "First Tracks",
    act: "Act I — The New Driver",
    region: "basecamp",
    blurb: "Report to Basecamp and pick up the supply drops. Everyone starts somewhere.",
    intro: {
      speaker: MARA,
      text: "So you're the new driver. Out here the map is the job — half this frontier has never seen a tyre track. Roll over to Basecamp so I can put a face to the dust cloud. And grab the supply drops on your way in; the airlift scattered them again.",
    },
    outro: {
      speaker: MARA,
      text: "Clean driving. Welcome to the Trailblazer Expedition. Don't get comfortable — the frontier doesn't.",
    },
    objectives: [
      { kind: "reach", target: [300, -300], radius: 14, hint: "Drive to the Basecamp beacon" },
      {
        kind: "collect",
        points: [
          [360, -360],
          [240, -250],
          [350, -210],
        ],
        hint: "Pick up the 3 scattered supply drops",
      },
    ],
    reward: 120,
    spawn: [-300, -300],
  },
  {
    n: 2,
    id: "shakedown",
    title: "Shakedown Run",
    act: "Act I — The New Driver",
    region: "speedway",
    blurb: "Prove the rig — and yourself — flat out on the Salt Pan, then report back.",
    intro: {
      speaker: RIG,
      text: "Before I trust you on the rough stuff, show me the rig holds together at speed. Run the survey markers on the Salt Pan, end to end, then bring her home in one piece. Mind the cacti.",
    },
    outro: {
      speaker: RIG,
      text: "Suspension's still attached and you didn't hit a single cactus. I've seen worse debuts. Mara wants you on the listening posts next.",
    },
    objectives: [
      {
        kind: "gates",
        points: [
          [110, 330],
          [210, 306],
          [310, 334],
          [410, 302],
          [500, 326],
        ],
        hint: "Run the survey markers in order",
      },
      { kind: "reach", target: [300, -300], radius: 16, hint: "Bring the rig back to Basecamp" },
    ],
    reward: 160,
    spawn: [50, 330],
  },
  {
    n: 3,
    id: "listening-posts",
    title: "The Listening Posts",
    act: "Act I — The New Driver",
    region: "ridge",
    blurb: "Three remote seismic posts have gone dark. Visit each and reset them.",
    intro: {
      speaker: JUNO,
      text: "Three of my listening posts stopped transmitting last week — Switchback Ridge, the Proving Grounds, Echo Canyon. Probably dust in the relays. Probably. Reset all three for me, and take the trails — the backcountry will eat your axles.",
    },
    outro: {
      speaker: JUNO,
      text: "All three back online... and that's odd. They didn't fail. Something switched them off. The seismic trace they recorded before going dark — I've only seen a pattern like that in the old Vanguard files.",
    },
    objectives: [
      {
        kind: "collect",
        points: [
          [-880, 280],
          [-300, 360],
          [880, -260],
        ],
        hint: "Reset the 3 listening posts (Ridge, Proving, Canyon)",
      },
    ],
    reward: 200,
    spawn: [-660, 300],
  },
  {
    n: 4,
    id: "whispers",
    title: "Whispers in the Pines",
    act: "Act I — The New Driver",
    region: "pines",
    blurb: "Recover the survey flags around Mirror Lake — and investigate what the last team left behind.",
    intro: {
      speaker: MARA,
      text: "Juno said the word 'Vanguard' and now I can't sleep. They were the first expedition out here — eleven rigs, gone without a distress call, years before us. Our flags around Mirror Lake need collecting anyway. While you're under the pines... keep your eyes open.",
    },
    outro: {
      speaker: MARA,
      text: "A wrecked rig, stripped for parts, half-sunk in the needles — that's Vanguard plate stamping. And a heading scratched into the door: 'EAST. THE SAND HAS THE REST.' They went toward the Dune Sea.",
    },
    objectives: [
      {
        kind: "collect",
        points: [
          [-760, -880],
          [-855, -748],
          [-1010, -800],
          [-1015, -955],
          [-860, -1015],
        ],
        hint: "Recover all 5 flags around Mirror Lake",
      },
      { kind: "reach", target: [-1090, -1060], radius: 13, hint: "Investigate the wreck deep in the pines" },
    ],
    reward: 220,
    spawn: [-660, -880],
  },

  // ===================== ACT II — THE VANGUARD TRAIL =====================
  {
    n: 5,
    id: "buried-in-sand",
    title: "Buried in Sand",
    act: "Act II — The Vanguard Trail",
    region: "dunes",
    blurb: "The Vanguard's black boxes are buried in the Dune Sea. Send it off the crests to spot them.",
    intro: {
      speaker: JUNO,
      text: "If their rigs died in the Dune Sea, the black boxes still chirp on shortwave — but the dunes block the signal unless you get HIGH. Catch real air off a crest so I can triangulate, then dig out every box you can find.",
    },
    outro: {
      speaker: JUNO,
      text: "Three black boxes. The last entries all say the same thing: ground tremors, compasses spinning... and an order from their lead to regroup 'up on the Mesa where the static clears.'",
    },
    objectives: [
      { kind: "bigair", seconds: 2.0, hint: "Catch 2.0s of air off a dune crest" },
      {
        kind: "collect",
        points: [
          [-420, 770],
          [-220, 880],
          [-340, 1020],
        ],
        hint: "Dig out the 3 Vanguard black boxes",
      },
    ],
    reward: 240,
    spawn: [-300, 730],
  },
  {
    n: 6,
    id: "static-on-the-mesa",
    title: "Static on the Mesa",
    act: "Act II — The Vanguard Trail",
    region: "mesa",
    blurb: "Climb High Mesa and sweep the plateau for the Vanguard's relay antennas.",
    intro: {
      speaker: JUNO,
      text: "The Mesa's flat top is the best antenna site for a hundred clicks — the Vanguard knew it too. Get up there and run a sweep between their old relay masts. The climb is the hard part; the top is a freeway.",
    },
    outro: {
      speaker: JUNO,
      text: "Their relay log survived. The last transmission routes through Echo Canyon... and it isn't a voice. It's a seismic alarm, repeating for nine years.",
    },
    objectives: [
      { kind: "reach", target: [-300, -900], radius: 18, minY: 20, hint: "Climb onto High Mesa's plateau" },
      {
        kind: "gates",
        points: [
          [-420, -980],
          [-300, -1020],
          [-180, -960],
          [-220, -840],
          [-380, -800],
        ],
        hint: "Sweep the relay masts on the plateau",
      },
    ],
    reward: 260,
    spawn: [-300, -640],
  },
  {
    n: 7,
    id: "echoes",
    title: "Echoes",
    act: "Act II — The Vanguard Trail",
    region: "canyon",
    blurb: "Trace the Vanguard's last transmission through Echo Canyon to their old camp under the arch.",
    intro: {
      speaker: MARA,
      text: "A nine-year alarm with no one alive to hear it. Juno traced it into Echo Canyon. Follow the canyon line marker to marker — and if you find their camp, treat it with respect. People slept there once.",
    },
    outro: {
      speaker: MARA,
      text: "Cold firepits under the arch, bedrolls still folded. They left in a hurry but in ORDER — this wasn't a panic. The quartermaster's ledger says they split: half to the Rift, half across the Mirage. We follow both.",
    },
    objectives: [
      {
        kind: "gates",
        points: [
          [820, -180],
          [900, -240],
          [980, -300],
          [920, -380],
          [860, -310],
        ],
        hint: "Trace the signal through the canyon markers",
      },
      { kind: "reach", target: [900, -340], radius: 13, hint: "Search the camp under the rock arch" },
    ],
    reward: 280,
    spawn: [780, -160],
  },
  {
    n: 8,
    id: "rift-letters",
    title: "The Rift Letters",
    act: "Act II — The Vanguard Trail",
    region: "rift",
    blurb: "Half the Vanguard went into the slot canyons. Their journals are still wedged in the rocks.",
    intro: {
      speaker: RIG,
      text: "The Rift is a maze with walls like knife blades — perfect place to lose eleven rigs, or hide them. Thread the canyon markers and grab any journals you spot. And kid... if the walls start humming, you drive OUT.",
    },
    outro: {
      speaker: RIG,
      text: "Two journals. The handwriting gets worse page by page. Last line, twice underlined: 'The mountain is hollow. The cone is NOT asleep. We go to wake the warning beacon.' They knew. Nine years ago, they knew.",
    },
    objectives: [
      {
        kind: "gates",
        points: [
          [860, 280],
          [902, 318],
          [944, 284],
          [960, 332],
          [914, 364],
          [878, 336],
        ],
        hint: "Thread the slot-canyon markers",
      },
      {
        kind: "collect",
        points: [
          [1000, 250],
          [840, 400],
        ],
        hint: "Recover the 2 weather-worn journals",
      },
    ],
    reward: 300,
    spawn: [820, 280],
  },
  {
    n: 9,
    id: "mirage",
    title: "Mirage",
    act: "Act II — The Vanguard Trail",
    region: "mirage",
    blurb: "Chase the other half of the trail across the dry lake — fast, before the light goes.",
    intro: {
      speaker: MARA,
      text: "The other half of the Vanguard ran the Mirage Flats at night, lights off, chasing something — or running from it. Their tyre scars are still baked into the crust. Follow them flat out across the pan. All of them.",
    },
    outro: {
      speaker: MARA,
      text: "The tracks end at a buried instrument case: a seismograph, still running on a thermal cell. Juno read the tape twice and went quiet. The volcano's heartbeat has been speeding up for nine years. It's nearly awake.",
    },
    objectives: [
      {
        kind: "gates",
        points: [
          [660, -880],
          [780, -920],
          [900, -860],
          [1020, -920],
          [1120, -870],
        ],
        hint: "Follow the tyre scars across the dry lake",
      },
      { kind: "reach", target: [1140, -960], radius: 13, hint: "Dig up the buried instrument case" },
    ],
    reward: 320,
    spawn: [620, -860],
  },

  // ===================== ACT III — THE WAKING CONE =====================
  {
    n: 10,
    id: "rumble",
    title: "Rumble",
    act: "Act III — The Waking Cone",
    region: "cinder",
    blurb: "Get instruments on Cinder Cone. Both rim stations. Do not touch the lava.",
    intro: {
      speaker: JUNO,
      text: "I need eyes on the crater — two sensor stations, opposite sides of the rim. The lava pool is live, the flank streams are live, and my insurance does not cover 'drove into a volcano'. Plant both and get clear.",
    },
    outro: {
      speaker: JUNO,
      text: "Readings are in and they're bad. The Vanguard's 'warning beacon' wasn't poetry — they built something on the summit of Granite Ascent to broadcast an eruption warning to the whole frontier. It never fired. We're going to finish their work.",
    },
    objectives: [
      { kind: "reach", target: [300, 790], radius: 15, minY: 30, hint: "Plant the north rim sensor" },
      { kind: "reach", target: [300, 1010], radius: 15, minY: 30, hint: "Plant the south rim sensor" },
    ],
    reward: 340,
    spawn: [300, 660],
  },
  {
    n: 11,
    id: "badlands-run",
    title: "The Badlands Run",
    act: "Act III — The Waking Cone",
    region: "badlands",
    blurb: "The beacon parts are cached across the Badlands. Bring a rig that can take a beating.",
    intro: {
      speaker: RIG,
      text: "The Vanguard cached the beacon's parts where nobody sane would follow: the Badlands. That ground will hammer a light rig to scrap — take the Boulder or the Juggernaut if you own one, and stay near the trail when you can. Bring me every crate.",
    },
    outro: {
      speaker: RIG,
      text: "Amplifier, mast sections, igniter coils — all here, all intact, you beautiful lunatic. One thing missing: the power core. The ledger says the Vanguard's lead carried it himself... up the mountain.",
    },
    objectives: [
      {
        kind: "gates",
        points: [
          [680, 880],
          [800, 930],
          [920, 870],
          [1040, 920],
        ],
        hint: "Push through the Badlands waypoints",
      },
      {
        kind: "collect",
        points: [
          [760, 1040],
          [1000, 1060],
          [1100, 800],
        ],
        hint: "Recover the 3 beacon part crates",
      },
    ],
    reward: 380,
    spawn: [640, 860],
  },
  {
    n: 12,
    id: "ashfall",
    title: "Ashfall",
    act: "Act III — The Waking Cone",
    region: "cinder",
    blurb: "The cone is venting. Pull Juno's sensors off the flanks before the ash buries them.",
    intro: {
      speaker: JUNO,
      text: "It's venting ash and my flank sensors are choking. I need all four pulled before the data's lost — they're scattered on the slopes BETWEEN the lava streams. Watch the glow, plan your line, don't gamble.",
    },
    outro: {
      speaker: JUNO,
      text: "Sensor data secured. Final projection: weeks, maybe days. The frontier gets one warning, and it has to come from the summit beacon. Everything we've done comes down to the mountain now.",
    },
    objectives: [
      {
        kind: "collect",
        points: [
          [420, 760],
          [160, 850],
          [200, 1060],
          [470, 930],
        ],
        hint: "Pull all 4 flank sensors (mind the lava streams)",
      },
    ],
    reward: 400,
    spawn: [300, 640],
  },
  {
    n: 13,
    id: "long-haul",
    title: "The Long Haul",
    act: "Act III — The Waking Cone",
    region: "basecamp",
    blurb: "Haul the beacon parts across the whole frontier to the mountain's trailhead. No shortcuts.",
    intro: {
      speaker: MARA,
      text: "Everything we recovered goes to the foot of Granite Ascent — one rig, one driver, you. It's the longest haul we've ever run: Basecamp, down past the Proving Grounds, through Boulder Basin, around the lake country, to the trailhead. Take the trails. Bring it home.",
    },
    outro: {
      speaker: MARA,
      text: "Every crate accounted for. Old Rig is bolting the beacon together at the trailhead and crying into his wrenches — don't tell him I said that. Rest up. Tomorrow we find what's left of the Vanguard.",
    },
    objectives: [
      {
        kind: "gates",
        points: [
          [300, -300],
          [-40, -120],
          [-300, 300],
          [-620, 540],
          [-900, 880],
          [-900, 300],
          [-700, -90],
        ],
        hint: "Run the convoy route to the mountain trailhead",
      },
    ],
    reward: 450,
    spawn: [300, -300],
  },

  // ===================== ACT IV — THE SUMMIT SIGNAL =====================
  {
    n: 14,
    id: "vanguard-found",
    title: "Vanguard Found",
    act: "Act IV — The Summit Signal",
    region: "ascent",
    blurb: "The Vanguard's last camp is on the mountain's lower spiral. Find it. Find them.",
    intro: {
      speaker: MARA,
      text: "Scouts spotted canvas on the first loop of the spiral road. That's their last camp — it has to be. Recover what matters: the power core, their records, their names. Whatever happened up there, the frontier should remember them right.",
    },
    outro: {
      speaker: MARA,
      text: "Eleven rigs parked in a line. Eleven notes, weighted with stones, every one addressed to family. And the power core, wrapped and waiting — they KNEW someone would come finish it. The last note says: 'The road is built. Drive it to the top.'",
    },
    objectives: [
      { kind: "reach", target: [-700, -95], radius: 14, hint: "Reach the spiral trailhead" },
      {
        kind: "collect",
        points: [
          [-655, -210],
          [-755, -440],
          [-1010, -380],
        ],
        hint: "Recover the camp caches on the lower spiral",
      },
    ],
    reward: 500,
    spawn: [-560, -60],
  },
  {
    n: 15,
    id: "summit-signal",
    title: "The Summit Signal",
    act: "Act IV — The Summit Signal",
    region: "ascent",
    blurb: "Drive the power core up the full spiral and light the warning beacon. For everyone.",
    intro: {
      speaker: RIG,
      text: "Beacon's assembled on the summit, mast up, coils cold — it just needs the core, and the core needs YOU. Four loops of road between you and the top. The mountain shook twice this morning. Don't stop for anything. Light it.",
    },
    outro: {
      speaker: MARA,
      text: "The beacon fired at dawn — every settlement on the frontier saw it and started moving to safe ground. Nine years late, the Vanguard's warning finally went out... carried the last mile by you. Whatever the volcano does now, nobody faces it blind. You didn't just blaze a trail. You finished theirs.",
    },
    objectives: [
      { kind: "reach", target: [-900, -300], radius: 24, minY: 180, hint: "Drive the spiral to the summit and light the beacon" },
    ],
    reward: 800,
    spawn: [-660, -110],
  },
];

export function chapter(n: number | null): Chapter | undefined {
  return n ? CHAPTERS.find((c) => c.n === n) : undefined;
}

// How many discrete steps an objective needs (for HUD progress).
export function objectiveGoal(o: Objective): number {
  if (o.kind === "collect" || o.kind === "gates") return o.points.length;
  return 1;
}
