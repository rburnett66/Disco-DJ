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
    "characterPrompt": "Pick your DJ and enter a stage name for the marq",
    "locationPrompt": "Choose a club to perform at",
    "locationCta": "Perform",
    "action": "Cue Record (SPACE)",
    "finish": "Set Complete",
    "count": "Combo",
    "results": "Results",
    "unit": "Hype",
    "item": "Beat-Note",
    "playAgain": "Spin Again",
    "home": "Menu",
    "miniGame": "Track Drop",
    "tiers": [
      "",
      "Local Spinner",
      "Club Resident",
      "Headliner"
    ]
  },
  "assets": {
    "screens": {
      "SC_scrab5f1vj": "content/screens/SC_scrab5f1vj.png",
      "SC_scru4678ee": "content/screens/SC_scru4678ee.png",
      "SC_scr29xml07": "content/screens/SC_scr29xml07.png",
      "SC_scrxn5t664": "content/screens/SC_scrxn5t664.png",
      "SC_scrp1kdjvt": "content/screens/SC_scrp1kdjvt.png",
      "SC_scrg8fmnkl": "content/screens/SC_scrg8fmnkl.png"
    },
    "sprites": {
      "balloongoldneutralbackgr": "content/sprites/balloongoldneutralbackgr.png",
      "balloonpurpleneutralback": "content/sprites/balloonpurpleneutralback.png",
      "balloonredneutralbackgro": "content/sprites/balloonredneutralbackgro.png",
      "balloonsilverneutralback": "content/sprites/balloonsilverneutralback.png",
      "discoballneutralbackgrou": "content/sprites/discoballneutralbackgrou.png",
      "dualturntabledjprocontro": "content/sprites/dualturntabledjprocontro.png",
      "femalebikinidancerneutra": "content/sprites/femalebikinidancerneutra.png",
      "femalecowgirldancerneutr": "content/sprites/femalecowgirldancerneutr.png",
      "femaledancerneutralbackg": "content/sprites/femaledancerneutralbackg.png",
      "femaledancerwithdiamondn": "content/sprites/femaledancerwithdiamondn.png",
      "femaledancerwithsparkler": "content/sprites/femaledancerwithsparkler.png",
      "maledancerneutralbackgro": "content/sprites/maledancerneutralbackgro.png",
      "maledancerwithglowstickn": "content/sprites/maledancerwithglowstickn.png",
      "maledancerwithgoldchainn": "content/sprites/maledancerwithgoldchainn.png",
      "malesecurityguarddancern": "content/sprites/malesecurityguarddancern.png",
      "roundvinyldiscnocover80s": "content/sprites/roundvinyldiscnocover80s.png",
      "roundvinyldiscnocoverdep": "content/sprites/roundvinyldiscnocoverdep.png",
      "roundvinyldiscnocoverkan": "content/sprites/roundvinyldiscnocoverkan.png",
      "roundvinyldiscnocovertay": "content/sprites/roundvinyldiscnocovertay.png",
      "sheet": "content/sprites/sheet.png",
      "vinyldiscnocover80sclass": "content/sprites/vinyldiscnocover80sclass.png",
      "vinyldiscnocoverdepechem": "content/sprites/vinyldiscnocoverdepechem.png",
      "vinyldiscnocoverdjmarcoa": "content/sprites/vinyldiscnocoverdjmarcoa.png",
      "vinyldiscnocoverkanyewes": "content/sprites/vinyldiscnocoverkanyewes.png",
      "vinyldiscnocovertaylorsw": "content/sprites/vinyldiscnocovertaylorsw.png"
    }
  },
  "data": {
    "sessionSeconds": 120,
    "resultsState": "MENU",
    "avatarSprite": "balloongoldneutralbackgr",
    "charIndex": 0,
    "locationIndex": 0,
    "collected": [],
    "phase": "roam",
    "characters": [
      {
        "name": "Disco Marco",
        "spr": "balloongoldneutralbackgr"
      },
      {
        "name": "Vinyl Vera",
        "spr": "balloonpurpleneutralback"
      },
      {
        "name": "Bass Brovic",
        "spr": "balloonredneutralbackgro"
      }
    ],
    "locations": [
      {
        "name": "Open-Mic Lounge",
        "diff": "1",
        "mix": [
          3,
          2,
          1,
          1,
          0
        ]
      },
      {
        "name": "Neon Underground",
        "diff": "2",
        "mix": [
          2,
          3,
          2,
          1,
          0
        ]
      },
      {
        "name": "Laser Palace",
        "diff": "2",
        "mix": [
          1,
          2,
          3,
          2,
          1
        ]
      },
      {
        "name": "Skyline Megaclub",
        "diff": "3",
        "mix": [
          1,
          2,
          2,
          3,
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
        "label": "Speaker",
        "name": "60-Watt Stack"
      }
    ],
    "itemTypes": [
      {
        "type": "Left-Lane Note"
      },
      {
        "type": "Right-Lane Note"
      },
      {
        "type": "Perfect Beat"
      },
      {
        "type": "Off-Beat Note"
      }
    ]
  },
  "mechanics": [
    "SessionTimer",
    "RhythmPlay"
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
          "DJGEAR"
        ],
        "labels": [
          "DJGEAR"
        ],
        "asset": "SC_scru4678ee",
        "back": "DJGEAR"
      },
      "next": [
        "DJGEAR"
      ]
    },
    {
      "name": "DJGEAR",
      "screen": "Stub",
      "cfg": {
        "title": "DJ GEAR",
        "navLabels": [
          "COREGAME"
        ],
        "labels": [
          "COREGAME"
        ],
        "asset": "SC_scrg8fmnkl",
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
