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
    "characterPrompt": "Pick your DJ and enter your stage name",
    "locationPrompt": "Choose your nightclub",
    "locationCta": "Confirm Venue",
    "action": "Drop the Track",
    "finish": "Roll to Home Booth",
    "count": "Booths Dropped",
    "results": "Set Results",
    "unit": "booths",
    "item": "Gear",
    "playAgain": "Spin Again",
    "home": "Menu",
    "miniGame": "Track-Drop Rhythm",
    "tiers": [
      "",
      "Bronze Spinner",
      "Silver Mixer",
      "Gold Headliner"
    ]
  },
  "assets": {
    "screens": {
      "SC_scrab5f1vj": "content/screens/SC_scrab5f1vj.png",
      "SC_scru4678ee": "content/screens/SC_scru4678ee.png",
      "SC_scrgc083l1": "content/screens/SC_scrgc083l1.png",
      "SC_scr29xml07": "content/screens/SC_scr29xml07.png",
      "SC_scrxn5t664": "content/screens/SC_scrxn5t664.png",
      "SC_scrp1kdjvt": "content/screens/SC_scrp1kdjvt.png"
    },
    "sprites": {}
  },
  "data": {
    "sessionSeconds": 120,
    "resultsState": "MENU",
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
        "name": "Neon Underground",
        "diff": "1",
        "mix": [
          2,
          1,
          1,
          1,
          0
        ]
      },
      {
        "name": "Funk Palace",
        "diff": "2",
        "mix": [
          1,
          2,
          1,
          1,
          0
        ]
      },
      {
        "name": "Laser Loft",
        "diff": "3",
        "mix": [
          1,
          1,
          1,
          1,
          1
        ]
      },
      {
        "name": "Mirrorball Megaclub",
        "diff": "4",
        "mix": [
          0,
          1,
          1,
          1,
          2
        ]
      }
    ],
    "gear": [
      {
        "label": "Deck",
        "name": "Battered Dual Turntable"
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
        "label": "Speaker Rig",
        "name": "60-Watt Stack"
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
      "screen": "Stub",
      "cfg": {
        "title": "MENU",
        "navLabels": [
          "CHOOSELOCATION"
        ],
        "labels": [
          "CHOOSELOCATION"
        ],
        "asset": "SC_scrab5f1vj",
        "back": "CHOOSELOCATION"
      },
      "next": [
        "CHOOSELOCATION"
      ]
    },
    {
      "name": "CHOOSELOCATION",
      "screen": "Stub",
      "cfg": {
        "title": "CHOOSE LOCATION",
        "navLabels": [
          "CHOOSEGEAR"
        ],
        "labels": [
          "CHOOSEGEAR"
        ],
        "asset": "SC_scru4678ee",
        "back": "CHOOSEGEAR"
      },
      "next": [
        "CHOOSEGEAR"
      ]
    },
    {
      "name": "CHOOSEGEAR",
      "screen": "Stub",
      "cfg": {
        "title": "CHOOSE GEAR",
        "navLabels": [
          "Lets Dance"
        ],
        "labels": [
          "Lets Dance"
        ],
        "asset": "SC_scrgc083l1",
        "back": "COREGAME"
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
          "GAMEPLAY"
        ],
        "labels": [
          "GAMEPLAY"
        ],
        "asset": "SC_scrp1kdjvt"
      },
      "next": [
        "GAMEPLAY"
      ]
    },
    {
      "name": "GAMEPLAY",
      "screen": "PlayField",
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
