/* Generated prototype config (data, not code) — composed by backend/prototype/scaffold.py
 * from an approved PrototypePlan + rule set. Edit the kit (runtime.js/modules.js) for
 * behaviour; edit this file for content. */
window.GAME_CONFIG = {
  "title": "Disco DJ Marco",
  "canvas": {
    "W": 960,
    "H": 600
  },
  "first": "MENU",
  "labels": {
    "characterPrompt": "Pick your DJ and enter a stage name",
    "locationPrompt": "Choose your nightclub venue",
    "locationCta": "Confirm Gear",
    "action": "Cue Record",
    "finish": "Roll Home",
    "count": "Booths Dropped",
    "results": "Set Results",
    "unit": "booths",
    "item": "booth",
    "playAgain": "Play Again",
    "home": "Menu",
    "miniGame": "Track Drop",
    "tiers": [
      "",
      "Local Opener",
      "Club Resident",
      "Headliner"
    ]
  },
  "assets": {
    "screens": {
      "SC_scrab5f1vj": "content/screens/SC_scrab5f1vj.png",
      "SC_scru4678ee": "content/screens/SC_scru4678ee.png",
      "SC_screr2mf9n": "content/screens/SC_screr2mf9n.png",
      "SC_scrrskt6dn": "content/screens/SC_scrrskt6dn.png",
      "SC_scrae09vxa": "content/screens/SC_scrae09vxa.png",
      "SC_scrm8rpgxd": "content/screens/SC_scrm8rpgxd.png",
      "SC_scr29xml07": "content/screens/SC_scr29xml07.png",
      "SC_scrgc083l1": "content/screens/SC_scrgc083l1.png",
      "SC_scrxn5t664": "content/screens/SC_scrxn5t664.png",
      "SC_scrp1kdjvt": "content/screens/SC_scrp1kdjvt.png"
    },
    "sprites": {}
  },
  "data": {
    "sessionSeconds": 120,
    "resultsState": "RESULTSREWARDS",
    "avatarSprite": "avatar",
    "charIndex": 0,
    "locationIndex": 0,
    "collected": [],
    "phase": "roam",
    "characters": [
      {
        "name": "Disco Marco"
      },
      {
        "name": "Vinyl Vera"
      },
      {
        "name": "Bass Brovic"
      }
    ],
    "locations": [
      {
        "name": "Mellow Lounge",
        "diff": "1",
        "mix": [
          3,
          1,
          1,
          0,
          0
        ]
      },
      {
        "name": "Neon Club",
        "diff": "2",
        "mix": [
          2,
          2,
          1,
          0,
          0
        ]
      },
      {
        "name": "Laser Palace",
        "diff": "3",
        "mix": [
          1,
          1,
          2,
          1,
          0
        ]
      },
      {
        "name": "Mega Disco",
        "diff": "4",
        "mix": [
          0,
          1,
          1,
          2,
          1
        ]
      }
    ],
    "gear": [
      {
        "label": "Deck",
        "name": "Battered Dual Turntable "
      },
      {
        "label": "Mixer",
        "name": "2-Channel Mixer"
      },
      {
        "label": "Needle",
        "name": "Bronze Needle"
      },
      {
        "label": "Speaker",
        "name": "60-Watt Speaker Stack"
      }
    ],
    "itemTypes": [
      {
        "type": "Deck"
      },
      {
        "type": "Needle"
      },
      {
        "type": "Mixer"
      },
      {
        "type": "Speaker Rig"
      }
    ]
  },
  "mechanics": [
    "SessionTimer",
    "NeonPlay"
  ],
  "states": [
    {
      "name": "MENU",
      "screen": "Menu",
      "cfg": {
        "title": "MENU",
        "navLabels": [
          "CHOOSELOCATION",
          "STORE",
          "SETTINGS",
          "CHARACTOR",
          "INVENTORY",
          "HELP",
          "GAMEPLAY"
        ],
        "labels": [
          "CHOOSELOCATION",
          "STORE",
          "SETTINGS",
          "CHARACTOR",
          "INVENTORY",
          "HELP",
          "GAMEPLAY"
        ],
        "asset": "SC_scrab5f1vj"
      },
      "next": [
        "CHOOSELOCATION",
        "STORE",
        "SETTINGS",
        "CHARACTOR",
        "INVENTORY",
        "HELP",
        "GAMEPLAY"
      ]
    },
    {
      "name": "CHOOSELOCATION",
      "screen": "Screen",
      "cfg": {
        "title": "CHOOSE LOCATION",
        "navLabels": [
          "CHOOSEGEAR"
        ],
        "labels": [
          "CHOOSEGEAR"
        ],
        "asset": "SC_scru4678ee"
      },
      "next": [
        "CHOOSEGEAR"
      ]
    },
    {
      "name": "STORE",
      "screen": "GearSelect",
      "cfg": {
        "title": "STORE",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scrrskt6dn"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "SETTINGS",
      "screen": "Screen",
      "cfg": {
        "title": "SETTINGS",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_screr2mf9n"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "CHARACTOR",
      "screen": "CharacterSelect",
      "cfg": {
        "title": "CHARACTOR",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scrm8rpgxd"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "INVENTORY",
      "screen": "GearSelect",
      "cfg": {
        "title": "INVENTORY",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scrae09vxa"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "HELP",
      "screen": "Screen",
      "cfg": {
        "title": "HELP",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ]
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "GAMEPLAY",
      "screen": "PlayField",
      "cfg": {
        "title": "LEADERBOARD",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ]
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "CHOOSEGEAR",
      "screen": "GearSelect",
      "cfg": {
        "title": "CHOOSE GEAR",
        "navLabels": [
          "Lets Dance"
        ],
        "labels": [
          "Lets Dance"
        ],
        "asset": "SC_scrgc083l1"
      },
      "next": [
        "COREGAME"
      ]
    },
    {
      "name": "COREGAME",
      "screen": "Screen",
      "cfg": {
        "title": "CORE GAME",
        "navLabels": [
          "RESULTSREWARDS"
        ],
        "labels": [
          "RESULTSREWARDS"
        ],
        "asset": "SC_scrp1kdjvt"
      },
      "next": [
        "RESULTSREWARDS"
      ]
    },
    {
      "name": "RESULTSREWARDS",
      "screen": "Results",
      "cfg": {
        "title": "RESULTS REWARDS",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scr29xml07"
      },
      "next": [
        "MENU"
      ]
    },
    {
      "name": "LOADINGSCREEN",
      "screen": "Stub",
      "cfg": {
        "title": "LOADING SCREEN",
        "navLabels": [
          "MENU"
        ],
        "labels": [
          "MENU"
        ],
        "asset": "SC_scrxn5t664",
        "back": "MENU"
      },
      "next": [
        "MENU"
      ]
    }
  ]
};
